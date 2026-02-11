import { getApiKey } from './auth';
import { setFlashBanner } from './flash';
import type { components, operations, paths } from '@/gen/openapi';

const API_BASE =
	import.meta.env.VITE_API_BASE ??
	import.meta.env.VITE_API_BASE_URL ??
	import.meta.env.VITE_TESTHUB_API_BASE_URL ??
	import.meta.env.VITE_API_URL ??
	'http://localhost:8080';
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

type AuthMode = 'session' | 'apiKey';

function getAuthMode(): AuthMode {
	if (typeof window === 'undefined') return 'session';
	try {
		const v = localStorage.getItem('testhub.authMode');
		return v === 'apiKey' ? 'apiKey' : 'session';
	} catch {
		return 'session';
	}
}

function shouldSendApiKey(path: string): boolean {
	// never attach API key to auth endpoints
	if (isAuthPath(path)) return false;

	// Only send API key when user explicitly chose API key mode
	return getAuthMode() === 'apiKey';
}

function pickApiKey(): string | undefined {
	const stored = getApiKey();
	return stored ?? DEV_API_KEY;
}

function isAuthPath(path: string): boolean {
	return path.startsWith('/auth/');
}

function isProjectScopedPath(path: string) {
	const normalized = path.split('?')[0] ?? '';
	if (!normalized.startsWith('/projects/')) return false;
	return normalized.length > '/projects/'.length;
}

/**
 * openapi-typescript uses numeric status keys: 200, 201, etc.
 */
type ResponseBody<
	P extends keyof paths,
	M extends keyof paths[P],
	Code extends number,
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
	};

	// ⭐ Only send API key when explicitly in API key mode
	if (apiKey && shouldSendApiKey(path)) {
		(headers as Record<string, string>)['x-api-key'] = apiKey;
	}

	const hasBody = init?.body != null;
	if (hasBody) {
		(headers as Record<string, string>)['content-type'] =
			(headers as Record<string, string>)['content-type'] ?? 'application/json';
	}

	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers,
		credentials: 'include',
	});

	if (!res.ok) {
		if (res.status === 404 && isProjectScopedPath(path)) {
			if (typeof window !== 'undefined') {
				try {
					localStorage.removeItem('lastProjectId');
				} catch {
					// ignore
				}
				setFlashBanner('That project no longer exists.');
				window.dispatchEvent(new CustomEvent('testhub.projectNotFound'));
			}
		}

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

// Tests
export type TestCaseListItem = components['schemas']['TestCaseListItem'];
export type TestCaseListResponse =
	components['schemas']['TestCaseListResponse'];
export type TestCaseHistoryItem = components['schemas']['TestCaseHistoryItem'];
export type TestCaseHistoryResponse =
	components['schemas']['TestCaseHistoryResponse'];

// Analytics
export type AnalyticsTimeseriesItem =
	components['schemas']['AnalyticsTimeseriesItem'];
export type AnalyticsTimeseriesResponse =
	components['schemas']['AnalyticsTimeseriesResponse'];

export type AnalyticsSlowTestItem =
	components['schemas']['AnalyticsSlowTestItem'];
export type AnalyticsSlowTestsResponse =
	components['schemas']['AnalyticsSlowTestsResponse'];

export type AnalyticsMostFailingTestItem =
	components['schemas']['AnalyticsMostFailingTestItem'];
export type AnalyticsMostFailingTestsResponse =
	components['schemas']['AnalyticsMostFailingTestsResponse'];

// Search
export type SearchTestItem = {
	id: string;
	name: string;
	externalId: string;
	suiteName: string | null;
	lastStatus: TestStatus | null;
	lastSeenAt: string | null;
};

export type SearchRunItem = {
	id: string;
	createdAt: string;
	status: RunStatus;
	branch: string | null;
	commitSha: string | null;
};

export type SearchResponse = {
	tests: SearchTestItem[];
	runs: SearchRunItem[];
};

// Projects
export type Project = components['schemas']['Project'];
export type ProjectListResponse = components['schemas']['ProjectListResponse'];
export type CreateProjectRequest =
	components['schemas']['CreateProjectRequest'];
export type UpdateProjectRequest =
	components['schemas']['UpdateProjectRequest'];

// Query types
export type ListRunsQuery = NonNullable<
	operations['listRuns']['parameters']['query']
>;

export type ListTestsQuery = NonNullable<
	operations['listTests']['parameters']['query']
>;

export type TestHistoryQuery = NonNullable<
	operations['getTestHistory']['parameters']['query']
>;

export type AnalyticsTimeseriesQuery = NonNullable<
	operations['getAnalyticsTimeseries']['parameters']['query']
>;
export type AnalyticsSlowestTestsQuery = NonNullable<
	operations['getAnalyticsSlowestTests']['parameters']['query']
>;
export type AnalyticsMostFailingTestsQuery = NonNullable<
	operations['getAnalyticsMostFailingTests']['parameters']['query']
>;

// Auth
export type AuthConfigResponse = {
	allowSignup: boolean;
};

export type AuthMeResponse = {
	user: { id: string; email?: string } | null;
	org: { id: string; slug?: string } | null;
	authStrategy: 'apiKey' | 'session';
	emailVerified: boolean;
};

// ---------- Typed API functions ----------

// Path aliases (OpenAPI paths)
type PathRuns = '/projects/{projectId}/runs';
type PathRun = '/projects/{projectId}/runs/{runId}';
type PathResults = '/projects/{projectId}/runs/{runId}/results';
type PathResultsBatch = '/projects/{projectId}/runs/{runId}/results/batch';

type PathTests = '/projects/{projectId}/tests';
type PathTestHistory = '/projects/{projectId}/tests/{testCaseId}/history';

type PathAnalyticsTimeseries = '/projects/{projectId}/analytics/timeseries';
type PathAnalyticsSlowestTests =
	'/projects/{projectId}/analytics/slowest-tests';
type PathAnalyticsMostFailingTests =
	'/projects/{projectId}/analytics/most-failing-tests';

type PathProjects = '/projects';
type PathProject = '/projects/{projectId}';

// ----- Projects -----

export function listProjects() {
	type Res = ResponseBody<PathProjects, 'get', 200>;
	return apiFetch<Res>('/projects');
}

export function getAuthConfig() {
	return apiFetch<AuthConfigResponse>('/auth/config');
}

export function registerEmailPassword(body: {
	email: string;
	password: string;
	fullName?: string;
}) {
	return apiFetch<{ ok: true }>('/auth/register', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export function loginEmailPassword(body: { email: string; password: string }) {
	return apiFetch<{ ok: true }>('/auth/login', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getAuthMe(): Promise<AuthMeResponse | null> {
	const res = await fetch(`${API_BASE}/auth/me`, {
		credentials: 'include',
		cache: 'no-store',
	});

	if (res.status === 401) return null;

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

	if (res.status === 204) return null;
	return (await res.json()) as AuthMeResponse;
}

export function logoutSession() {
	return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function logout() {
	return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function forgotPassword(body: { email: string }) {
	return apiFetch<void>('/auth/password/forgot', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export function resetPassword(body: { token: string; newPassword: string }) {
	return apiFetch<void>('/auth/password/reset', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export function resendVerification(body: { email: string }) {
	return apiFetch<void>('/auth/resend-verification', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export function getVerifyEmailUrl(token: string) {
	return `${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export function createProject(body: CreateProjectRequest) {
	type Req = RequestBody<PathProjects, 'post'>;
	type Res = ResponseBody<PathProjects, 'post', 201>;

	const payload: Req = body;

	return apiFetch<Res>('/projects', {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

export function getProject(projectId: string) {
	type Res = ResponseBody<PathProject, 'get', 200>;
	return apiFetch<Res>(`/projects/${encodeURIComponent(projectId)}`);
}

export function updateProject(projectId: string, body: UpdateProjectRequest) {
	type Req = RequestBody<PathProject, 'patch'>;
	type Res = ResponseBody<PathProject, 'patch', 200>;

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

export function listRuns(projectSlug: string, query?: Partial<ListRunsQuery>) {
	type Res = ResponseBody<PathRuns, 'get', 200>;
	const params = new URLSearchParams();
	if (query?.limit) params.set('limit', String(query.limit));
	if (query?.cursor) params.set('cursor', query.cursor);
	if (query?.status) params.set('status', query.status);
	const queryString = params.toString();
	const path = `/projects/${encodeURIComponent(projectSlug)}/runs${
		queryString ? `?${queryString}` : ''
	}`;
	return apiFetch<Res>(path);
}

export function createRun(projectSlug: string, body?: CreateRunRequest) {
	type Req = RequestBody<PathRuns, 'post'>;
	type Res = ResponseBody<PathRuns, 'post', 201>;

	const payload: Req = body ?? { source: 'manual' };

	return apiFetch<Res>(`/projects/${encodeURIComponent(projectSlug)}/runs`, {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

export function getRun(projectSlug: string, runId: string) {
	type Res = ResponseBody<PathRun, 'get', 200>;
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
	type Res = ResponseBody<PathResults, 'get', 200>;
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
	type Res = ResponseBody<PathResultsBatch, 'post', 201>;

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

// ----- Tests -----

export function listTests(
	projectSlug: string,
	query?: Partial<ListTestsQuery>,
) {
	type Res = ResponseBody<PathTests, 'get', 200>;
	const params = new URLSearchParams();
	if (query?.limit) params.set('limit', String(query.limit));
	if (query?.q) params.set('q', query.q);
	if (query?.suite) params.set('suite', query.suite);
	if (query?.status) params.set('status', query.status);
	const queryString = params.toString();
	const path = `/projects/${encodeURIComponent(projectSlug)}/tests${
		queryString ? `?${queryString}` : ''
	}`;
	return apiFetch<Res>(path);
}

export function getTestHistory(
	projectSlug: string,
	testCaseId: string,
	query?: Partial<TestHistoryQuery>,
) {
	type Res = ResponseBody<PathTestHistory, 'get', 200>;
	const params = new URLSearchParams();
	if (query?.limit) params.set('limit', String(query.limit));
	const queryString = params.toString();
	const path = `/projects/${encodeURIComponent(projectSlug)}/tests/${encodeURIComponent(
		testCaseId,
	)}/history${queryString ? `?${queryString}` : ''}`;
	return apiFetch<Res>(path);
}

// ----- Analytics -----

export function getAnalyticsTimeseries(
	projectSlug: string,
	query?: Partial<AnalyticsTimeseriesQuery>,
) {
	type Res = ResponseBody<PathAnalyticsTimeseries, 'get', 200>;
	const params = new URLSearchParams();
	if (query?.days) params.set('days', String(query.days));
	const queryString = params.toString();
	const path = `/projects/${encodeURIComponent(projectSlug)}/analytics/timeseries${
		queryString ? `?${queryString}` : ''
	}`;
	return apiFetch<Res>(path);
}

export function getAnalyticsSlowestTests(
	projectSlug: string,
	query?: Partial<AnalyticsSlowestTestsQuery>,
) {
	type Res = ResponseBody<PathAnalyticsSlowestTests, 'get', 200>;
	const params = new URLSearchParams();
	if (query?.days) params.set('days', String(query.days));
	if (query?.limit) params.set('limit', String(query.limit));
	const queryString = params.toString();
	const path = `/projects/${encodeURIComponent(projectSlug)}/analytics/slowest-tests${
		queryString ? `?${queryString}` : ''
	}`;
	return apiFetch<Res>(path);
}

export function getAnalyticsMostFailingTests(
	projectSlug: string,
	query?: Partial<AnalyticsMostFailingTestsQuery>,
) {
	type Res = ResponseBody<PathAnalyticsMostFailingTests, 'get', 200>;
	const params = new URLSearchParams();
	if (query?.days) params.set('days', String(query.days));
	if (query?.limit) params.set('limit', String(query.limit));
	const queryString = params.toString();
	const path = `/projects/${encodeURIComponent(projectSlug)}/analytics/most-failing-tests${
		queryString ? `?${queryString}` : ''
	}`;
	return apiFetch<Res>(path);
}

// ----- Search -----

export function searchProject(projectSlug: string, q: string, limit = 5) {
	const params = new URLSearchParams();
	params.set('q', q);
	params.set('limit', String(limit));
	return apiFetch<SearchResponse>(
		`/projects/${encodeURIComponent(projectSlug)}/search?${params.toString()}`,
	);
}
