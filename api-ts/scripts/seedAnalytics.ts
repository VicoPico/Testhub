type ApiStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';

type TestCaseSeed = {
	externalId: string;
	name: string;
	suiteName: string;
	tags: string[];
	baseDuration: number;
	spikeDuration?: number;
	spikeRate?: number;
};

type ResultInput = {
	externalId: string;
	name: string;
	status: ApiStatus;
	durationMs: number;
	tags: string[];
	suiteName: string;
	message?: string;
	stacktrace?: string;
};

type RunResponse = {
	id: string;
	createdAt: string;
	status: string;
	projectId: string;
};

const API_BASE = process.env.API_BASE ?? 'http://localhost:8080';
const PROJECT_SLUG = process.env.PROJECT_SLUG ?? 'project-nemesis';
const COOKIE = process.env.COOKIE;
const API_KEY = process.env.API_KEY;
const RUN_COUNT = Number(process.env.RUN_COUNT ?? 8);

const suites = [
	'auth',
	'ui',
	'api',
	'email',
	'regression',
	'billing',
	'search',
];
const tagPool = [
	'auth',
	'ui',
	'api',
	'email',
	'regression',
	'smoke',
	'critical',
	'payments',
	'notifications',
	'analytics',
	'onboarding',
	'permissions',
	'profile',
	'webhooks',
	'dashboard',
	'mobile',
	'edge',
	'flaky',
	'sso',
];

const testCases: TestCaseSeed[] = [
	{
		externalId: 'auth.login.valid',
		name: 'Login with valid credentials',
		suiteName: 'auth',
		tags: ['auth', 'critical', 'smoke'],
		baseDuration: 320,
		spikeDuration: 5200,
		spikeRate: 0.2,
	},
	{
		externalId: 'api.results.batch',
		name: 'Batch ingest results',
		suiteName: 'api',
		tags: ['api', 'regression', 'analytics'],
		baseDuration: 480,
		spikeDuration: 4100,
		spikeRate: 0.25,
	},
	{
		externalId: 'ui.dashboard.load',
		name: 'Dashboard load time',
		suiteName: 'ui',
		tags: ['ui', 'performance', 'dashboard'],
		baseDuration: 650,
		spikeDuration: 6000,
		spikeRate: 0.2,
	},
	{
		externalId: 'email.reset.link',
		name: 'Password reset email sent',
		suiteName: 'email',
		tags: ['email', 'notifications'],
		baseDuration: 420,
	},
	{
		externalId: 'regression.tags.filter',
		name: 'Filter tests by tag',
		suiteName: 'regression',
		tags: ['regression', 'ui'],
		baseDuration: 380,
	},
	{
		externalId: 'search.tests.query',
		name: 'Search tests by name',
		suiteName: 'search',
		tags: ['search', 'api'],
		baseDuration: 300,
	},
	{
		externalId: 'billing.invoice.pdf',
		name: 'Billing invoice download',
		suiteName: 'billing',
		tags: ['billing', 'payments'],
		baseDuration: 520,
	},
	{
		externalId: 'auth.session.refresh',
		name: 'JWT session refresh',
		suiteName: 'auth',
		tags: ['auth', 'security'],
		baseDuration: 240,
	},
	{
		externalId: 'ui.theme.toggle',
		name: 'UI theme toggle',
		suiteName: 'ui',
		tags: ['ui', 'regression'],
		baseDuration: 210,
	},
	{
		externalId: 'api.rate.limit',
		name: 'API rate limit handling',
		suiteName: 'api',
		tags: ['api', 'edge'],
		baseDuration: 360,
	},
];

function randomInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickTags(seed: TestCaseSeed): string[] {
	const picked = new Set(seed.tags);
	while (picked.size < Math.min(3, seed.tags.length + 1)) {
		picked.add(tagPool[randomInt(0, tagPool.length - 1)]);
	}
	return Array.from(picked).slice(0, randomInt(2, 3));
}

function statusForCase(): ApiStatus {
	const roll = Math.random();
	if (roll < 0.78) return 'PASSED';
	if (roll < 0.9) return 'FAILED';
	if (roll < 0.96) return 'ERROR';
	return 'SKIPPED';
}

function durationForCase(seed: TestCaseSeed): number {
	const base = seed.baseDuration;
	const spike = seed.spikeDuration ?? base * 3;
	const spikeRate = seed.spikeRate ?? 0.1;
	const variance = randomInt(-60, 120);
	if (Math.random() < spikeRate) {
		return Math.max(100, spike + randomInt(-200, 300));
	}
	return Math.max(100, base + variance);
}

function buildResult(seed: TestCaseSeed): ResultInput {
	const status = statusForCase();
	const durationMs = durationForCase(seed);
	const tags = pickTags(seed);
	const result: ResultInput = {
		externalId: seed.externalId,
		name: seed.name,
		status,
		durationMs,
		tags,
		suiteName: seed.suiteName,
	};

	if (status === 'FAILED' || status === 'ERROR') {
		result.message =
			status === 'FAILED'
				? 'Assertion failed: expected status 200'
				: 'Unhandled error: timeout waiting for selector';
		result.stacktrace = 'Error: failure\n  at test.fn (tests/spec.ts:42:11)';
	}

	return result;
}

function guardDev() {
	if (process.env.NODE_ENV === 'production') {
		throw new Error('Refusing to seed analytics in production.');
	}
}

function buildHeaders(): HeadersInit {
	const headers: HeadersInit = {
		'content-type': 'application/json',
	};
	if (COOKIE) headers.cookie = COOKIE;
	if (API_KEY) headers['x-api-key'] = API_KEY;
	return headers;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		method: 'POST',
		headers: buildHeaders(),
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
	}
	return (await res.json()) as T;
}

async function main() {
	guardDev();

	const runsToCreate = Math.min(10, Math.max(6, RUN_COUNT));
	const createdRunIds: string[] = [];
	const perCaseDurations = new Map<string, number[]>();

	for (let i = 0; i < runsToCreate; i += 1) {
		const run = await postJson<RunResponse>(
			`/projects/${encodeURIComponent(PROJECT_SLUG)}/runs`,
			{
				source: 'seed',
				branch: `seed/analytics-${i + 1}`,
				commitSha: Math.random().toString(16).slice(2, 10),
				meta: { seed: 'analytics', index: i + 1 },
			},
		);
		createdRunIds.push(run.id);

		const perRunCount = randomInt(8, 15);
		const shuffled = [...testCases].sort(() => Math.random() - 0.5);
		const chosen = shuffled.slice(0, perRunCount);
		const results = chosen.map((seed) => buildResult(seed));

		for (const result of results) {
			const list = perCaseDurations.get(result.externalId) ?? [];
			list.push(result.durationMs);
			perCaseDurations.set(result.externalId, list);
		}

		await postJson(
			`/projects/${encodeURIComponent(
				PROJECT_SLUG,
			)}/runs/${encodeURIComponent(run.id)}/results/batch`,
			{ results },
		);

		process.stdout.write(
			`✔ run ${i + 1}/${runsToCreate} — ${run.id} (${results.length} results)\n`,
		);
	}

	const summary = Array.from(perCaseDurations.entries()).map(
		([externalId, durations]) => {
			const min = Math.min(...durations);
			const max = Math.max(...durations);
			const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
			return { externalId, min, avg, max };
		},
	);

	const slowest = summary
		.sort((a, b) => b.avg - a.avg)
		.slice(0, 3)
		.map(
			(row) =>
				`${row.externalId} min=${Math.round(row.min)} avg=${Math.round(
					row.avg,
				)} max=${Math.round(row.max)}`,
		);

	process.stdout.write(`\nCreated runs:\n${createdRunIds.join('\n')}\n`);
	process.stdout.write(`\nSlowest cases summary:\n${slowest.join('\n')}\n`);
	process.stdout.write('\nDone.\n');
}

main().catch((err) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(`Seed analytics failed: ${message}\n`);
	process.exit(1);
});
