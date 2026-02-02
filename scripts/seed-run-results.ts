const API_BASE = 'http://localhost:8080';
const PROJECT_SLUG = 'project-nemesis';
const RUN_ID = 'cml1hmb880001sb3yttj0q00n';
const SESSION_COOKIE = 'testhub_session=REPLACE_ME';

type ApiStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';

type ResultInput = {
	externalId: string;
	name: string;
	status: ApiStatus;
	durationMs: number;
	tags: string[];
	suiteName: string;
	message?: string;
	stacktrace?: string;
	meta?: Record<string, unknown>;
};

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

const testNames = [
	'Login with valid credentials',
	'Login with invalid password',
	'Password reset email sent',
	'Verify email link works',
	'Create project form submits',
	'Project list loads',
	'Run details render',
	'Analytics chart loads',
	'Filter tests by tag',
	'Export test results',
	'Retry failed run',
	'Webhook delivery retry',
	'Dashboard load time',
	'Invite member flow',
	'Role change audit log',
	'API key rotation',
	'SSO login redirect',
	'Billing invoice download',
	'Email digest delivery',
	'Notifications toggle',
	'Create run via API',
	'Batch ingest results',
	'Purge old runs',
	'Search tests by name',
	'Update project settings',
	'Readonly user restrictions',
	'Regressions overview',
	'UI theme toggle',
	'Help center links',
	'Pagination stability',
	'Latency percentile card',
	'Flaky test detection',
	'Test history timeline',
	'API rate limit handling',
	'JWT session refresh',
	'Logout clears session',
];

function randomInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickTags(count: number) {
	const picked = new Set<string>();
	while (picked.size < count) {
		picked.add(tagPool[randomInt(0, tagPool.length - 1)]);
	}
	return Array.from(picked);
}

function randomStatus(): { label: 'passed' | 'failed' | 'flaky' | 'skipped' } {
	const roll = Math.random();
	if (roll < 0.62) return { label: 'passed' };
	if (roll < 0.82) return { label: 'failed' };
	if (roll < 0.92) return { label: 'flaky' };
	return { label: 'skipped' };
}

function toApiStatus(
	label: 'passed' | 'failed' | 'flaky' | 'skipped',
): ApiStatus {
	if (label === 'skipped') return 'SKIPPED';
	if (label === 'failed' || label === 'flaky') return 'FAILED';
	return 'PASSED';
}

function buildResult(index: number, batchId: string): ResultInput {
	const statusRoll = randomStatus();
	const suiteName = suites[randomInt(0, suites.length - 1)];
	const name = testNames[index % testNames.length];
	const durationMs = randomInt(100, 5000);
	const tags = pickTags(randomInt(2, 3));
	const externalId = `${suiteName}.${index}.${batchId}`;
	const status = toApiStatus(statusRoll.label);

	const meta: Record<string, unknown> = {
		seedBatch: batchId,
		flaky: statusRoll.label === 'flaky',
	};

	const result: ResultInput = {
		externalId,
		name,
		status,
		durationMs,
		tags:
			statusRoll.label === 'flaky'
				? Array.from(new Set([...tags, 'flaky']))
				: tags,
		suiteName,
		meta,
	};

	if (status === 'FAILED') {
		result.message =
			statusRoll.label === 'flaky'
				? 'Intermittent failure: timeout waiting for selector'
				: 'Assertion failed: expected status 200';
		result.stacktrace =
			'Error: Assertion failed\n  at test.fn (tests/spec.ts:42:11)';
	}

	return result;
}

async function postBatch(results: ResultInput[], batchIndex: number) {
	const res = await fetch(
		`${API_BASE}/projects/${encodeURIComponent(
			PROJECT_SLUG,
		)}/runs/${encodeURIComponent(RUN_ID)}/results/batch`,
		{
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				cookie: SESSION_COOKIE,
			},
			body: JSON.stringify({ results }),
		},
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`batch ${batchIndex} failed: ${res.status} ${text}`);
	}

	process.stdout.write(
		`✔ sent batch ${batchIndex} (${results.length} results)\n`,
	);
}

export async function main() {
	const total = randomInt(25, 40);
	const batchId = `${Date.now().toString(36)}-${randomInt(1000, 9999)}`;
	const results: ResultInput[] = [];
	for (let i = 0; i < total; i += 1) {
		results.push(buildResult(i, batchId));
	}

	const firstBatchSize = Math.min(20, results.length);
	const batches = [
		results.slice(0, firstBatchSize),
		results.slice(firstBatchSize),
	].filter((batch) => batch.length > 0);

	for (let i = 0; i < batches.length; i += 1) {
		await postBatch(batches[i], i + 1);
	}

	process.stdout.write(
		`Summary: sent ${results.length} results across ${batches.length} batch(es).\n`,
	);
}

main().catch((err) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(`Seed failed: ${message}\n`);
	process.exit(1);
});
