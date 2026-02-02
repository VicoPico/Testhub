import { randomBytes } from 'node:crypto';
import prismaPkg from '@prisma/client';
import { hashToken } from '../src/lib/authPasswords';

const { PrismaClient } = prismaPkg;

type StepResult = { name: string; ok: boolean; details?: string };

type CookieJar = {
	cookie?: string;
};

const API_BASE = process.env.TESTHUB_API_BASE ?? 'http://localhost:8080';

function randomEmail() {
	const token = randomBytes(6).toString('hex');
	return `auth-smoke+${token}@example.com`;
}

function logPass(name: string) {
	process.stdout.write(`[PASS] ${name}\n`);
}

function logFail(name: string, details?: string) {
	process.stdout.write(`[FAIL] ${name}${details ? ` — ${details}` : ''}\n`);
}

function getSetCookieHeader(res: Response): string | undefined {
	const header = res.headers.get('set-cookie') ?? undefined;
	return header;
}

function extractCookie(header?: string): string | undefined {
	if (!header) return undefined;
	const first = header.split(',')[0] ?? header;
	const cookie = first.split(';')[0];
	return cookie || undefined;
}

async function request(
	path: string,
	opts: RequestInit = {},
	jar?: CookieJar,
): Promise<Response> {
	const headers = new Headers(opts.headers ?? {});
	if (jar?.cookie) headers.set('cookie', jar.cookie);
	const res = await fetch(`${API_BASE}${path}`, {
		...opts,
		headers,
		redirect: 'manual',
	});
	const setCookie = getSetCookieHeader(res);
	const nextCookie = extractCookie(setCookie);
	if (nextCookie) {
		if (jar) jar.cookie = nextCookie;
	}
	return res;
}

async function readJson(res: Response): Promise<any> {
	try {
		return await res.json();
	} catch {
		return null;
	}
}

async function runStep(
	name: string,
	fn: () => Promise<void>,
	results: StepResult[],
) {
	try {
		await fn();
		results.push({ name, ok: true });
		logPass(name);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		results.push({ name, ok: false, details: message });
		logFail(name, message);
	}
}

async function main() {
	const results: StepResult[] = [];
	const prisma = new PrismaClient();
	await prisma.$connect();

	const email = randomEmail();
	const password = 'CorrectHorseBatteryStaple1!';
	const newPassword = 'CorrectHorseBatteryStaple2!';
	const jar: CookieJar = {};

	await runStep(
		'auth config allows signup',
		async () => {
			const res = await request('/auth/config');
			if (!res.ok) throw new Error(`status ${res.status}`);
			const body = await readJson(res);
			if (!body?.allowSignup) {
				throw new Error('ALLOW_SIGNUP is false; enable for smoke test');
			}
		},
		results,
	);

	await runStep(
		'register',
		async () => {
			const res = await request('/auth/register', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, password, fullName: 'Smoke Test' }),
			});
			if (res.status !== 201) {
				const body = await readJson(res);
				throw new Error(`status ${res.status} ${body?.message ?? ''}`.trim());
			}
		},
		results,
	);

	await runStep(
		'verify email',
		async () => {
			const user = await prisma.user.findUnique({ where: { email } });
			if (!user) throw new Error('user not found');
			const raw = randomBytes(32).toString('hex');
			await prisma.emailVerificationToken.create({
				data: {
					userId: user.id,
					tokenHash: hashToken(raw),
					expiresAt: new Date(Date.now() + 60 * 60 * 1000),
				},
			});
			const res = await request(`/auth/verify-email?token=${raw}`);
			if (res.status !== 302) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'login wrong password',
		async () => {
			const res = await request('/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, password: 'wrong' }),
			});
			if (res.status !== 401) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'login',
		async () => {
			const res = await request(
				'/auth/login',
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ email, password }),
				},
				jar,
			);
			if (res.status !== 200) throw new Error(`status ${res.status}`);
			if (!jar.cookie) throw new Error('missing session cookie');
		},
		results,
	);

	await runStep(
		'session persists (same client)',
		async () => {
			const res = await request('/auth/me', {}, jar);
			if (res.status !== 200) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'session persists (new client instance)',
		async () => {
			const newJar: CookieJar = { cookie: jar.cookie };
			const res = await request('/auth/me', {}, newJar);
			if (res.status !== 200) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'forgot password',
		async () => {
			const res = await request('/auth/password/forgot', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email }),
			});
			if (res.status !== 204) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'expired verification token',
		async () => {
			const user = await prisma.user.findUnique({ where: { email } });
			if (!user) throw new Error('user not found');
			const raw = randomBytes(32).toString('hex');
			await prisma.emailVerificationToken.create({
				data: {
					userId: user.id,
					tokenHash: hashToken(raw),
					expiresAt: new Date(Date.now() - 60 * 1000),
				},
			});
			const res = await request(`/auth/verify-email?token=${raw}`);
			if (res.status !== 400) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'expired reset token',
		async () => {
			const user = await prisma.user.findUnique({ where: { email } });
			if (!user) throw new Error('user not found');
			const raw = randomBytes(32).toString('hex');
			await prisma.passwordResetToken.create({
				data: {
					userId: user.id,
					tokenHash: hashToken(raw),
					expiresAt: new Date(Date.now() - 60 * 1000),
				},
			});
			const res = await request('/auth/password/reset', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: raw, newPassword }),
			});
			if (res.status !== 400) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'reset password',
		async () => {
			const user = await prisma.user.findUnique({ where: { email } });
			if (!user) throw new Error('user not found');
			const raw = randomBytes(32).toString('hex');
			await prisma.passwordResetToken.create({
				data: {
					userId: user.id,
					tokenHash: hashToken(raw),
					expiresAt: new Date(Date.now() + 60 * 60 * 1000),
				},
			});
			const res = await request('/auth/password/reset', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: raw, newPassword }),
			});
			if (res.status !== 204) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'login with new password',
		async () => {
			const res = await request('/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, password: newPassword }),
			});
			if (res.status !== 200) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'logout',
		async () => {
			const res = await request('/auth/logout', { method: 'POST' }, jar);
			if (res.status !== 204) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'new request after logout returns 401',
		async () => {
			const res = await request('/auth/me', {}, jar);
			if (res.status !== 401) throw new Error(`status ${res.status}`);
		},
		results,
	);

	await runStep(
		'session removed in DB while logged in',
		async () => {
			const res = await request(
				'/auth/login',
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ email, password: newPassword }),
				},
				jar,
			);
			if (res.status !== 200 || !jar.cookie) {
				throw new Error(`status ${res.status}`);
			}
			const user = await prisma.user.findUnique({ where: { email } });
			if (!user) throw new Error('user not found');
			const latestSession = await prisma.session.findFirst({
				where: { userId: user.id },
				orderBy: { createdAt: 'desc' },
			});
			if (!latestSession) throw new Error('session not found');
			await prisma.session.deleteMany({ where: { id: latestSession.id } });
			const me = await request('/auth/me', {}, jar);
			if (me.status !== 401) throw new Error(`status ${me.status}`);
		},
		results,
	);

	await prisma.$disconnect();

	const failed = results.filter((r) => !r.ok);
	if (failed.length) {
		process.stdout.write(`\nFailed ${failed.length} step(s).\n`);
		process.exit(1);
	}
	process.stdout.write('\nAll auth smoke tests passed.\n');
}

main().catch((err) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stdout.write(`[FAIL] auth smoke test runner — ${message}\n`);
	process.exit(1);
});
