import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import {
	generateToken,
	hashPassword,
	hashToken,
	verifyPassword,
} from '../lib/authPasswords';

const GithubCallbackQuery = z.object({
	code: z.string().min(1),
	state: z.string().min(1),
});

const RegisterBody = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	fullName: z.string().min(1).optional(),
});

const LoginBody = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

const VerifyEmailQuery = z.object({
	token: z.string().min(1),
});

const ForgotPasswordBody = z.object({
	email: z.string().email(),
});

const ResetPasswordBody = z.object({
	token: z.string().min(1),
	newPassword: z.string().min(8),
});

const ResendVerificationBody = z.object({
	email: z.string().email(),
});

const SESSION_TTL_DAYS = 30;
const STATE_COOKIE_SUFFIX = '_state';
const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number) {
	const now = Date.now();
	const entry = rateBuckets.get(key);
	if (!entry || entry.resetAt <= now) {
		rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
		return;
	}
	entry.count += 1;
	if (entry.count > limit) {
		throw new Error('rate_limit');
	}
}

function toSlug(value: string) {
	return (
		value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 48) || 'org'
	);
}

function isSecure(url: string) {
	return url.startsWith('https://');
}

async function fetchGithubJson<T>(url: string, token: string): Promise<T> {
	const res = await fetch(url, {
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${token}`,
			'user-agent': 'testhub',
		},
	});
	if (!res.ok) {
		throw new Error(`GitHub API error (${res.status})`);
	}
	return (await res.json()) as T;
}

async function exchangeGithubCode(opts: {
	clientId: string;
	clientSecret: string;
	code: string;
	redirectUri: string;
	state: string;
}) {
	const res = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			client_id: opts.clientId,
			client_secret: opts.clientSecret,
			code: opts.code,
			redirect_uri: opts.redirectUri,
			state: opts.state,
		}),
	});
	const json = (await res.json()) as {
		access_token?: string;
		token_type?: string;
		scope?: string;
		error?: string;
		error_description?: string;
	};
	if (!res.ok || !json.access_token) {
		throw new Error(json.error_description || 'GitHub OAuth failed');
	}
	return json.access_token;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
	app.get('/auth/config', async () => {
		return { allowSignup: app.config.ALLOW_SIGNUP };
	});

	app.post('/auth/register', async (req, reply) => {
		if (!app.config.ALLOW_SIGNUP) {
			throw app.httpErrors.forbidden('Signups are disabled');
		}

		const body = RegisterBody.parse(req.body);
		const email = body.email.trim().toLowerCase();
		const passwordHash = await hashPassword(body.password);

		const existing = await app.prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});
		if (existing) {
			throw app.httpErrors.conflict('Email already registered');
		}

		const now = new Date();
		const user = await app.prisma.user.create({
			data: {
				email,
				passwordHash,
				fullName: body.fullName?.trim() || undefined,
			},
			select: { id: true },
		});

		const membership = await app.prisma.membership.findFirst({
			where: { userId: user.id },
			select: { orgId: true },
		});

		let orgId = membership?.orgId;
		if (!orgId) {
			const baseSlug = toSlug(email.split('@')[0] || 'org');
			let slug = baseSlug;
			let suffix = 2;

			while (await app.prisma.organization.findUnique({ where: { slug } })) {
				slug = `${baseSlug}-${suffix}`;
				suffix += 1;
			}

			const org = await app.prisma.organization.create({
				data: {
					name: `${email.split('@')[0] || 'User'} Organization`,
					slug,
				},
				select: { id: true },
			});
			orgId = org.id;

			await app.prisma.membership.create({
				data: {
					orgId,
					userId: user.id,
					role: 'ADMIN',
				},
			});
		}

		const rawToken = generateToken();
		const tokenHash = hashToken(rawToken);
		const expiresAt = new Date(
			now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
		);

		await app.prisma.emailVerificationToken.create({
			data: {
				userId: user.id,
				tokenHash,
				expiresAt,
			},
		});

		app.log.info(
			{ email },
			`Email verification link: ${app.config.WEB_APP_URL}/verify-email?token=${rawToken}`,
		);

		return reply.code(201).send({ ok: true });
	});

	app.post('/auth/login', async (req, reply) => {
		try {
			checkRateLimit(`login:${req.ip}`, 10, 60_000);
		} catch {
			req.log.warn({ reasonCode: 'rate_limited' }, 'auth.login.blocked');
			throw app.httpErrors.tooManyRequests('Too many attempts');
		}

		const body = LoginBody.parse(req.body);
		const email = body.email.trim().toLowerCase();
		const user = await app.prisma.user.findUnique({
			where: { email },
			select: { id: true, passwordHash: true, emailVerifiedAt: true },
		});

		if (!user || !user.passwordHash) {
			req.log.warn(
				{ email, reasonCode: 'invalid_password' },
				'auth.login.failed',
			);
			throw app.httpErrors.unauthorized('Invalid email or password');
		}

		const valid = await verifyPassword(body.password, user.passwordHash);
		if (!valid) {
			req.log.warn(
				{ email, reasonCode: 'invalid_password' },
				'auth.login.failed',
			);
			throw app.httpErrors.unauthorized('Invalid email or password');
		}

		if (!user.emailVerifiedAt) {
			req.log.warn(
				{ email, reasonCode: 'email_not_verified' },
				'auth.login.blocked',
			);
			const rawToken = generateToken();
			const tokenHash = hashToken(rawToken);
			const expiresAt = new Date(
				Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
			);

			await app.prisma.emailVerificationToken.create({
				data: {
					userId: user.id,
					tokenHash,
					expiresAt,
				},
			});

			app.log.info(
				{ email },
				`Email verification link: ${app.config.WEB_APP_URL}/verify-email?token=${rawToken}`,
			);

			throw app.httpErrors.forbidden('Email not verified');
		}

		const membership = await app.prisma.membership.findFirst({
			where: { userId: user.id },
			select: { orgId: true },
		});

		let orgId = membership?.orgId;
		if (!orgId) {
			const baseSlug = toSlug(email.split('@')[0] || 'org');
			let slug = baseSlug;
			let suffix = 2;

			while (await app.prisma.organization.findUnique({ where: { slug } })) {
				slug = `${baseSlug}-${suffix}`;
				suffix += 1;
			}

			const org = await app.prisma.organization.create({
				data: {
					name: `${email.split('@')[0] || 'User'} Organization`,
					slug,
				},
				select: { id: true },
			});
			orgId = org.id;

			await app.prisma.membership.create({
				data: {
					orgId,
					userId: user.id,
					role: 'ADMIN',
				},
			});
		}

		const now = new Date();
		const expiresAt = new Date(
			now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
		);
		const sessionId = generateToken();

		await app.prisma.session.create({
			data: {
				id: sessionId,
				userId: user.id,
				orgId,
				expiresAt,
				lastSeenAt: now,
			},
		});

		reply.setCookie(app.config.AUTH_COOKIE_NAME, sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isSecure(app.config.PUBLIC_BASE_URL),
			signed: true,
			maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
		});

		return reply.code(200).send({ ok: true });
	});

	app.get('/auth/verify-email', async (req, reply) => {
		const query = VerifyEmailQuery.parse(req.query);
		const tokenHash = hashToken(query.token);
		const now = new Date();

		const token = await app.prisma.emailVerificationToken.findUnique({
			where: { tokenHash },
			select: { id: true, userId: true, expiresAt: true, consumedAt: true },
		});

		if (!token || token.consumedAt || token.expiresAt <= now) {
			req.log.warn(
				{
					reasonCode: token ? 'expired_token' : 'invalid_token',
				},
				'auth.verify_email.failed',
			);
			throw app.httpErrors.badRequest('Invalid or expired token');
		}

		await app.prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: token.userId },
				data: { emailVerifiedAt: now },
			});

			await tx.emailVerificationToken.update({
				where: { id: token.id },
				data: { consumedAt: now },
			});

			await tx.emailVerificationToken.updateMany({
				where: { userId: token.userId, consumedAt: null },
				data: { consumedAt: now },
			});
		});

		return reply.redirect(`${app.config.WEB_APP_URL}/projects?verified=1`);
	});

	app.post('/auth/password/forgot', async (req, reply) => {
		try {
			checkRateLimit(`forgot:${req.ip}`, 5, 60_000);
		} catch {
			return reply.code(204).send();
		}

		const body = ForgotPasswordBody.parse(req.body);
		const email = body.email.trim().toLowerCase();
		const user = await app.prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});

		if (user) {
			const rawToken = generateToken();
			const tokenHash = hashToken(rawToken);
			const expiresAt = new Date(
				Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000,
			);

			await app.prisma.passwordResetToken.create({
				data: {
					userId: user.id,
					tokenHash,
					expiresAt,
				},
			});

			app.log.info(
				{ email },
				`Password reset link: ${app.config.WEB_APP_URL}/reset-password?token=${rawToken}`,
			);
		}

		return reply.code(204).send();
	});

	app.post('/auth/resend-verification', async (req, reply) => {
		const body = ResendVerificationBody.parse(req.body);
		const email = body.email.trim().toLowerCase();
		const user = await app.prisma.user.findUnique({
			where: { email },
			select: { id: true, emailVerifiedAt: true },
		});

		if (user && !user.emailVerifiedAt) {
			const rawToken = generateToken();
			const tokenHash = hashToken(rawToken);
			const expiresAt = new Date(
				Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
			);

			await app.prisma.emailVerificationToken.create({
				data: {
					userId: user.id,
					tokenHash,
					expiresAt,
				},
			});

			app.log.info(
				{ email },
				`Email verification link: ${app.config.WEB_APP_URL}/verify-email?token=${rawToken}`,
			);
		}

		return reply.code(204).send();
	});

	app.post('/auth/password/reset', async (req, reply) => {
		const body = ResetPasswordBody.parse(req.body);
		const tokenHash = hashToken(body.token);
		const now = new Date();

		const token = await app.prisma.passwordResetToken.findUnique({
			where: { tokenHash },
			select: { id: true, userId: true, expiresAt: true, consumedAt: true },
		});

		if (!token || token.consumedAt || token.expiresAt <= now) {
			req.log.warn(
				{
					reasonCode: token ? 'expired_token' : 'invalid_token',
				},
				'auth.password_reset.failed',
			);
			throw app.httpErrors.badRequest('Invalid or expired token');
		}

		const passwordHash = await hashPassword(body.newPassword);

		await app.prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: token.userId },
				data: { passwordHash },
			});

			await tx.passwordResetToken.update({
				where: { id: token.id },
				data: { consumedAt: now },
			});

			await tx.session.updateMany({
				where: { userId: token.userId },
				data: { revokedAt: now },
			});
		});

		return reply.code(204).send();
	});
	app.get('/auth/github/login', async (_req, reply) => {
		const state = randomBytes(16).toString('hex');
		const cookieName = `${app.config.AUTH_COOKIE_NAME}${STATE_COOKIE_SUFFIX}`;
		reply.setCookie(cookieName, state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isSecure(app.config.PUBLIC_BASE_URL),
			signed: true,
			maxAge: 10 * 60,
		});

		const redirectUri = `${app.config.PUBLIC_BASE_URL}/auth/github/callback`;
		const params = new URLSearchParams({
			client_id: app.config.GITHUB_CLIENT_ID,
			redirect_uri: redirectUri,
			state,
			scope: 'read:user user:email',
		});
		return reply.redirect(`https://github.com/login/oauth/authorize?${params}`);
	});

	app.get('/auth/github/callback', async (req, reply) => {
		const query = GithubCallbackQuery.parse(req.query);
		const cookieName = `${app.config.AUTH_COOKIE_NAME}${STATE_COOKIE_SUFFIX}`;
		const rawState = req.cookies?.[cookieName];
		if (!rawState) {
			throw app.httpErrors.unauthorized('Missing OAuth state');
		}
		const unsigned = req.unsignCookie(rawState);
		if (!unsigned.valid || unsigned.value !== query.state) {
			throw app.httpErrors.unauthorized('Invalid OAuth state');
		}

		reply.clearCookie(cookieName, { path: '/' });

		const redirectUri = `${app.config.PUBLIC_BASE_URL}/auth/github/callback`;
		const accessToken = await exchangeGithubCode({
			clientId: app.config.GITHUB_CLIENT_ID,
			clientSecret: app.config.GITHUB_CLIENT_SECRET,
			code: query.code,
			redirectUri,
			state: query.state,
		});

		const ghUser = await fetchGithubJson<{
			id: number;
			login: string;
			name: string | null;
			email: string | null;
		}>('https://api.github.com/user', accessToken);

		const emails = await fetchGithubJson<
			Array<{ email: string; primary: boolean; verified: boolean }>
		>('https://api.github.com/user/emails', accessToken);
		const primary = emails.find((e) => e.primary && e.verified);
		const verified = emails.find((e) => e.verified);
		const email = primary?.email ?? verified?.email ?? null;

		if (!email) {
			throw app.httpErrors.unauthorized('GitHub account has no verified email');
		}

		const githubId = String(ghUser.id);
		const now = new Date();
		const expiresAt = new Date(
			now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
		);

		const result = await app.prisma.$transaction(async (tx) => {
			const existingByGithub = await tx.user.findUnique({
				where: { githubId },
			});
			let user = existingByGithub;

			if (!user) {
				const existingByEmail = await tx.user.findUnique({
					where: { email },
				});
				if (existingByEmail) {
					user = await tx.user.update({
						where: { id: existingByEmail.id },
						data: {
							githubId,
							fullName: ghUser.name ?? existingByEmail.fullName,
							nickname: ghUser.login ?? existingByEmail.nickname,
						},
					});
				} else {
					user = await tx.user.create({
						data: {
							email,
							githubId,
							fullName: ghUser.name ?? undefined,
							nickname: ghUser.login ?? undefined,
						},
					});
				}
			}

			const membership = await tx.membership.findFirst({
				where: { userId: user.id },
				select: { orgId: true },
			});

			let orgId = membership?.orgId;
			if (!orgId) {
				const baseSlug = toSlug(ghUser.login || email.split('@')[0] || 'org');
				let slug = baseSlug;
				let suffix = 2;

				while (await tx.organization.findUnique({ where: { slug } })) {
					slug = `${baseSlug}-${suffix}`;
					suffix += 1;
				}

				const org = await tx.organization.create({
					data: {
						name: `${ghUser.login || 'User'} Organization`,
						slug,
					},
					select: { id: true },
				});
				orgId = org.id;

				await tx.membership.create({
					data: {
						orgId,
						userId: user.id,
						role: 'ADMIN',
					},
				});
			}

			const sessionId = randomBytes(32).toString('hex');
			await tx.session.create({
				data: {
					id: sessionId,
					userId: user.id,
					orgId,
					expiresAt,
					lastSeenAt: now,
				},
			});

			return { sessionId };
		});

		reply.setCookie(app.config.AUTH_COOKIE_NAME, result.sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isSecure(app.config.PUBLIC_BASE_URL),
			signed: true,
			maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
		});

		return reply.redirect(app.config.WEB_APP_URL);
	});

	app.get('/auth/me', async (req) => {
		const auth = req.ctx.auth;
		if (!auth.isAuthenticated) {
			throw app.httpErrors.unauthorized('Authentication required');
		}

		let emailVerified = auth.strategy === 'apiKey';
		if (!emailVerified && req.ctx.user?.id) {
			const user = await app.prisma.user.findUnique({
				where: { id: req.ctx.user.id },
				select: { emailVerifiedAt: true },
			});
			emailVerified = Boolean(user?.emailVerifiedAt);
		}

		return {
			user: req.ctx.user,
			org: req.ctx.org,
			authStrategy: auth.strategy,
			emailVerified,
		};
	});

	app.post('/auth/logout', async (req, reply) => {
		const auth = req.ctx.auth;
		if (!auth.isAuthenticated) {
			throw app.httpErrors.unauthorized('Authentication required');
		}

		if (auth.strategy === 'session') {
			await app.prisma.session.updateMany({
				where: { id: auth.session.id },
				data: { revokedAt: new Date() },
			});
		}

		reply.clearCookie(app.config.AUTH_COOKIE_NAME, { path: '/' });
		return reply.code(204).send();
	});
};
