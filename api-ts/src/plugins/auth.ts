import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { parseApiKey, sha256Hex, safeEqualHex } from '../lib/apiKey';

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
	app.addHook('onRequest', async (req, reply) => {
		if (req.ctx.auth.isAuthenticated) return;

		// Session cookie auth (preferred when valid)
		const rawCookie = req.cookies?.[app.config.AUTH_COOKIE_NAME];
		if (rawCookie) {
			const unsigned = req.unsignCookie(rawCookie);
			if (!unsigned.valid) {
				req.log.warn({ reasonCode: 'invalid_cookie' }, 'auth.session.invalid');
				reply.clearCookie(app.config.AUTH_COOKIE_NAME, { path: '/' });
			}

			const sessionId = unsigned.value;
			if (sessionId) {
				const now = new Date();
				const session = await app.prisma.session.findUnique({
					where: { id: sessionId },
					select: {
						id: true,
						expiresAt: true,
						revokedAt: true,
						orgId: true,
						userId: true,
						org: { select: { id: true, slug: true } },
						user: { select: { id: true, email: true } },
					},
				});

				if (session && !session.revokedAt && session.expiresAt > now) {
					req.ctx.auth = {
						isAuthenticated: true,
						strategy: 'session',
						session: { id: session.id },
						orgId: session.orgId,
						userId: session.userId,
					};

					req.ctx.org = session.org
						? { id: session.org.id, slug: session.org.slug }
						: { id: session.orgId };

					req.ctx.user = session.user
						? { id: session.user.id, email: session.user.email }
						: { id: session.userId };

					app.prisma.session
						.update({ where: { id: session.id }, data: { lastSeenAt: now } })
						.catch((err: unknown) => {
							req.log.warn(
								{ err, sessionId: session.id },
								'Failed to update Session.lastSeenAt',
							);
						});

					return;
				}

				if (session) {
					const reasonCode = session.revokedAt
						? 'revoked_session'
						: session.expiresAt <= now
							? 'expired_session'
							: 'invalid_session';
					req.log.warn({ reasonCode }, 'auth.session.invalid');
				} else {
					req.log.warn(
						{ reasonCode: 'missing_session' },
						'auth.session.invalid',
					);
				}

				reply.clearCookie(app.config.AUTH_COOKIE_NAME, { path: '/' });
			}
		}

		const header = req.headers['x-api-key'];
		if (header == null) return;

		// Fastify headers can be string | string[] | undefined
		const raw = Array.isArray(header) ? header[0] : header;
		if (!raw) return;

		const parsed = parseApiKey(raw);
		if (!parsed) {
			throw app.httpErrors.unauthorized('Invalid API key format');
		}

		const { prefix, raw: rawKey } = parsed;
		const presentedHash = sha256Hex(rawKey);
		const now = new Date();

		const apiKey = await app.prisma.apiKey.findUnique({
			where: { prefix },
			select: {
				id: true,
				prefix: true,
				hash: true,
				orgId: true,
				userId: true,
				revokedAt: true,
				expiresAt: true,
				org: { select: { id: true, slug: true } },
				user: { select: { id: true, email: true } },
			},
		});

		if (!apiKey) throw app.httpErrors.unauthorized('Invalid API key');
		if (apiKey.revokedAt) throw app.httpErrors.unauthorized('API key revoked');
		if (apiKey.expiresAt && apiKey.expiresAt <= now) {
			throw app.httpErrors.unauthorized('API key expired');
		}

		if (!safeEqualHex(apiKey.hash, presentedHash)) {
			throw app.httpErrors.unauthorized('Invalid API key');
		}

		req.ctx.auth = {
			isAuthenticated: true,
			strategy: 'apiKey',
			apiKey: { id: apiKey.id, prefix: apiKey.prefix },
			orgId: apiKey.orgId,
			userId: apiKey.userId ?? null,
		};

		req.ctx.org = apiKey.org
			? { id: apiKey.org.id, slug: apiKey.org.slug }
			: { id: apiKey.orgId };

		req.ctx.user = apiKey.user
			? { id: apiKey.user.id, email: apiKey.user.email }
			: apiKey.userId
				? { id: apiKey.userId }
				: null;

		// best-effort lastUsedAt
		app.prisma.apiKey
			.update({ where: { id: apiKey.id }, data: { lastUsedAt: now } })
			.catch((err: unknown) => {
				req.log.warn(
					{ err, apiKeyId: apiKey.id },
					'Failed to update ApiKey.lastUsedAt',
				);
			});
	});
});
