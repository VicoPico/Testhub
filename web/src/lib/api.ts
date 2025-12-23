const API_BASE = 'http://localhost:8080';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			'content-type': 'application/json',
			...(init?.headers ?? {}),
		},
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(
			`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`
		);
	}

	// handle 204 etc
	if (res.status === 204) return undefined as T;

	return (await res.json()) as T;
}

export type RunStatus =
	| 'QUEUED'
	| 'RUNNING'
	| 'COMPLETED'
	| 'FAILED'
	| 'CANCELED';

export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';

export type RunListItem = {
	id: string;
	createdAt: string;
	status: RunStatus;
	source?: string | null;
	commitSha?: string | null;
	branch?: string | null;
	startedAt?: string | null;
	finishedAt?: string | null;
	durationMs?: number | null;
	totalCount: number;
	passedCount: number;
	failedCount: number;
	skippedCount: number;
	errorCount: number;
};

export type RunDetails = {
	id: string;
	projectId: string;
	status: RunStatus;
	createdAt: string;
	source?: string | null;
	branch?: string | null;
	commitSha?: string | null;
	startedAt?: string | null;
	finishedAt?: string | null;
	durationMs?: number | null;
	totalCount: number;
	passedCount: number;
	failedCount: number;
	skippedCount: number;
	errorCount: number;
};

export type RunResultItem = {
	id: string;
	status: TestStatus;
	durationMs?: number | null;
	message?: string | null;
	createdAt: string;
	testCase: {
		id: string;
		externalId: string;
		name: string;
		suiteName?: string | null;
		tags: string[];
	};
};

export async function listRuns(projectIdOrSlug: string) {
	return apiFetch<{ items: RunListItem[]; nextCursor: string | null }>(
		`/projects/${encodeURIComponent(projectIdOrSlug)}/runs`
	);
}

export async function createRun(projectIdOrSlug: string) {
	return apiFetch<{
		id: string;
		createdAt: string;
		status: RunStatus;
		projectId: string;
	}>(`/projects/${encodeURIComponent(projectIdOrSlug)}/runs`, {
		method: 'POST',
		body: JSON.stringify({ source: 'manual' }),
	});
}

export async function getRun(projectIdOrSlug: string, runId: string) {
	// NOTE: currently your backend treats :projectId as the DB projectId (not slug).
	// We'll later patch runs.ts to resolve slug -> project id end-to-end.
	return apiFetch<RunDetails>(
		`/projects/${encodeURIComponent(projectIdOrSlug)}/runs/${encodeURIComponent(
			runId
		)}`
	);
}

export async function listRunResults(projectIdOrSlug: string, runId: string) {
	return apiFetch<{ items: RunResultItem[] }>(
		`/projects/${encodeURIComponent(projectIdOrSlug)}/runs/${encodeURIComponent(
			runId
		)}/results`
	);
}
