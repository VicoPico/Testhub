import { getApiKey } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

// Optional dev fallback (don’t put real secrets here)
const DEV_API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

export class ApiError extends Error {
	status: number;
	statusText: string;
	details?: unknown;

	constructor(opts: {
		status: number;
		statusText: string;
		message: string;
		details?: unknown;
	}) {
		super(opts.message);
		this.name = 'ApiError';
		this.status = opts.status;
		this.statusText = opts.statusText;
		this.details = opts.details;
	}
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null;
}

async function parseErrorBody(res: Response): Promise<unknown> {
	const ct = res.headers.get('content-type') ?? '';
	if (ct.includes('application/json')) {
		try {
			return await res.json();
		} catch {
			// fall through
		}
	}
	try {
		const t = await res.text();
		return t || undefined;
	} catch {
		return undefined;
	}
}

function pickApiKey(): string | undefined {
	// LocalStorage wins; env is fallback for dev convenience.
	const stored = getApiKey();
	return stored ?? DEV_API_KEY;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const apiKey = pickApiKey();

	const headers: HeadersInit = {
		...(init?.headers ?? {}),
		...(apiKey ? { 'x-api-key': apiKey } : {}),
	};

	// only set content-type when we're actually sending JSON
	const hasBody = init?.body != null;
	if (hasBody) {
		(headers as Record<string, string>)['content-type'] =
			(headers as Record<string, string>)['content-type'] ?? 'application/json';
	}

	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers,
	});

	if (!res.ok) {
		const details = await parseErrorBody(res);

		let message = `${res.status} ${res.statusText}`;
		if (typeof details === 'string' && details.trim()) {
			message = `${message} — ${details}`;
		} else if (isRecord(details) && typeof details.message === 'string') {
			message = `${message} — ${details.message}`;
		}

		throw new ApiError({
			status: res.status,
			statusText: res.statusText,
			message,
			details,
		});
	}

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

export function listRuns(projectSlug: string) {
	return apiFetch<{ items: RunListItem[]; nextCursor: string | null }>(
		`/projects/${encodeURIComponent(projectSlug)}/runs`
	);
}

export function createRun(projectSlug: string) {
	return apiFetch<{
		id: string;
		createdAt: string;
		status: RunStatus;
		projectId: string;
	}>(`/projects/${encodeURIComponent(projectSlug)}/runs`, {
		method: 'POST',
		body: JSON.stringify({ source: 'manual' }),
	});
}

export function getRun(projectSlug: string, runId: string) {
	return apiFetch<RunDetails>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId
		)}`
	);
}

export function listRunResults(projectSlug: string, runId: string) {
	return apiFetch<{ items: RunResultItem[] }>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId
		)}/results`
	);
}
