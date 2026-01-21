import { getApiKey } from './auth';
import type { components, paths } from '@/gen/openapi';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';
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
	const stored = getApiKey();
	return stored ?? DEV_API_KEY;
}

/**
 * openapi-typescript uses string status keys: '200', '201', etc.
 */
type ResponseBody<
	P extends keyof paths,
	M extends keyof paths[P],
	Code extends string,
> = paths[P][M] extends { responses: infer R }
	? Code extends keyof R
		? R[Code] extends { content: { 'application/json': infer B } }
			? B
			: never
		: never
	: never;

type RequestBody<
	P extends keyof paths,
	M extends keyof paths[P],
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

	const hasBody = init?.body != null;
	if (hasBody) {
		(headers as Record<string, string>)['content-type'] =
			(headers as Record<string, string>)['content-type'] ?? 'application/json';
	}

	const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

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

// Runs / Results
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

export type BatchResultsRequest = components['schemas']['BatchResultsRequest'];
export type BatchResultsResponse =
	components['schemas']['BatchResultsResponse'];

// Projects
export type Project = components['schemas']['Project'];
export type ProjectListResponse = components['schemas']['ProjectListResponse'];
export type CreateProjectRequest =
	components['schemas']['CreateProjectRequest'];
export type UpdateProjectRequest =
	components['schemas']['UpdateProjectRequest'];

// ---------- Typed API functions ----------

// Path aliases (OpenAPI paths)
type PathRuns = '/projects/{projectId}/runs';
type PathRun = '/projects/{projectId}/runs/{runId}';
type PathResults = '/projects/{projectId}/runs/{runId}/results';
type PathResultsBatch = '/projects/{projectId}/runs/{runId}/results/batch';

type PathProjects = '/projects';
type PathProject = '/projects/{projectId}';

// ----- Projects -----

export function listProjects() {
	type Res = ResponseBody<PathProjects, 'get', '200'>;
	return apiFetch<Res>('/projects');
}

export function createProject(body: CreateProjectRequest) {
	type Req = RequestBody<PathProjects, 'post'>;
	type Res = ResponseBody<PathProjects, 'post', '201'>;

	const payload: Req = body;

	return apiFetch<Res>('/projects', {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

export function getProject(projectId: string) {
	type Res = ResponseBody<PathProject, 'get', '200'>;
	return apiFetch<Res>(`/projects/${encodeURIComponent(projectId)}`);
}

export function updateProject(projectId: string, body: UpdateProjectRequest) {
	type Req = RequestBody<PathProject, 'patch'>;
	type Res = ResponseBody<PathProject, 'patch', '200'>;

	const payload: Req = body;

	return apiFetch<Res>(`/projects/${encodeURIComponent(projectId)}`, {
		method: 'PATCH',
		body: JSON.stringify(payload),
	});
}

export function deleteProject(projectId: string) {
	return apiFetch<void>(`/projects/${encodeURIComponent(projectId)}`, {
		method: 'DELETE',
	});
}

// ----- Runs -----

export function listRuns(projectSlug: string) {
	type Res = ResponseBody<PathRuns, 'get', '200'>;
	return apiFetch<Res>(`/projects/${encodeURIComponent(projectSlug)}/runs`);
}

export function createRun(projectSlug: string) {
	type Req = RequestBody<PathRuns, 'post'>;
	type Res = ResponseBody<PathRuns, 'post', '201'>;

	const body: Req = { source: 'manual' };

	return apiFetch<Res>(`/projects/${encodeURIComponent(projectSlug)}/runs`, {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export function getRun(projectSlug: string, runId: string) {
	type Res = ResponseBody<PathRun, 'get', '200'>;
	return apiFetch<Res>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId,
		)}`,
	);
}

export function deleteRun(projectSlug: string, runId: string) {
	return apiFetch<void>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId,
		)}`,
		{
			method: 'DELETE',
		},
	);
}

export function listRunResults(projectSlug: string, runId: string) {
	type Res = ResponseBody<PathResults, 'get', '200'>;
	return apiFetch<Res>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId,
		)}/results`,
	);
}

export function batchIngestResults(
	projectSlug: string,
	runId: string,
	body: BatchResultsRequest,
) {
	type Res = ResponseBody<PathResultsBatch, 'post', '201'>;

	return apiFetch<Res>(
		`/projects/${encodeURIComponent(projectSlug)}/runs/${encodeURIComponent(
			runId,
		)}/results/batch`,
		{
			method: 'POST',
			body: JSON.stringify(body),
		},
	);
}
