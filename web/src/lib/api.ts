// web/src/lib/api.ts
import { getApiKey } from './auth';
import type { components, paths } from '@/gen/openapi';

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

/**
 * Narrow OpenAPI response bodies from paths[...] definitions.
 * Example: ResponseBody<'/health','get',200>
 */
type ResponseBody<
	P extends keyof paths,
	M extends keyof paths[P],
	Code extends number
> = paths[P][M] extends { responses: infer R }
	? Code extends keyof R
		? R[Code] extends { content: { 'application/json': infer B } }
			? B
			: never
		: never
	: never;

/**
 * Narrow OpenAPI request bodies from paths[...] definitions.
 * Example: RequestBody<'/projects/{projectId}/runs','post'>
 */
type RequestBody<
	P extends keyof paths,
	M extends keyof paths[P]
> = paths[P][M] extends {
	requestBody: { content: { 'application/json': infer B } };
}
	? B
	: never;

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

// ---------- OpenAPI-derived domain types ----------

export type RunStatus = components['schemas']['RunStatus'];
export type TestStatus = components['schemas']['TestStatus'];

export type RunListItem = components['schemas']['RunListItem'];
export type RunListResponse = components['schemas']['RunListResponse'];

export type RunDetails = components['schemas']['RunDetails'];

export type RunResultItem = components['schemas']['RunResultItem'];
export type RunResultListResponse =
	components['schemas']['RunResultListResponse'];

export type CreateRunRequest = components['schemas']['CreateRunRequest'];
export type CreateRunResponse = components['schemas']['CreateRunResponse'];

// NOTE: your actual endpoint is /projects/{projectId}/runs/{runId}/results
// and you renamed batch to /projects/{projectId}/runs/{runId}/results/batch
export type BatchResultsRequest = components['schemas']['BatchResultsRequest'];
export type BatchResultsResponse =
	components['schemas']['BatchResultsResponse'];

// ---------- Typed API functions ----------

const PATH_RUNS = '/projects/{projectId}/runs' as const;
const PATH_RUN = '/projects/{projectId}/runs/{runId}' as const;
const PATH_RESULTS = '/projects/{projectId}/runs/{runId}/results' as const;
const PATH_RESULTS_BATCH =
	'/projects/{projectId}/runs/{runId}/results/batch' as const;

export function listRuns(projectSlug: string) {
	type Res = ResponseBody<typeof PATH_RUNS, 'get', 200>;
	return apiFetch<Res>(`/projects/${encodeURIComponent(projectSlug)}/runs`);
}

export function createRun(projectSlug: string) {
	type Req = RequestBody<typeof PATH_RUNS, 'post'>;
	type Res = ResponseBody<typeof PATH_RUNS, 'post', 201>;

	const body: Req = { source: 'manual' };

	return apiFetch<Res>(`/projects/${encodeURIComponent(projectSlug)}/runs`, {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export function getRun(projectSlug: string, runId: string) {
	type Res = ResponseBody<typeof PATH_RUN, 'get', 200>;
	return apiFetch<Res>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId
		)}`
	);
}

export function listRunResults(projectSlug: string, runId: string) {
	type Res = ResponseBody<typeof PATH_RESULTS, 'get', 200>;
	return apiFetch<Res>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId
		)}/results`
	);
}

export function batchIngestResults(
	projectSlug: string,
	runId: string,
	body: BatchResultsRequest
) {
	type Res = ResponseBody<typeof PATH_RESULTS_BATCH, 'post', 200>;

	return apiFetch<Res>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId
		)}/results/batch`,
		{
			method: 'POST',
			body: JSON.stringify(body),
		}
	);
}
