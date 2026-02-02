import * as React from 'react';
import { Link, useParams } from 'react-router-dom';

import {
	listRuns,
	createRun,
	batchIngestResults,
	deleteRun,
	ApiError,
	getProject,
	type BatchResultsRequest,
	type CreateRunRequest,
	type RunListItem,
	type RunStatus,
	type ListRunsQuery,
} from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageError, PageLoading } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';
import { useAuth } from '@/lib/useAuth';

function formatDate(iso: string) {
	const d = new Date(iso);
	return d.toLocaleString();
}

function runStatusBadgeClass(status: RunListItem['status']) {
	switch (status) {
		case 'COMPLETED':
			return 'border-[color:var(--test-passed)] text-[color:var(--test-passed)] bg-[color-mix(in_oklch,var(--test-passed)_16%,transparent)]';
		case 'FAILED':
			return 'border-[color:var(--test-failed)] text-[color:var(--test-failed)] bg-[color-mix(in_oklch,var(--test-failed)_16%,transparent)]';
		case 'RUNNING':
		case 'QUEUED':
			return 'border-[color:var(--test-paused)] text-[color:var(--test-paused)] bg-[color-mix(in_oklch,var(--test-paused)_16%,transparent)]';
		case 'CANCELED':
			return 'border-[color:var(--test-skipped)] text-[color:var(--test-skipped)] bg-[color-mix(in_oklch,var(--test-skipped)_16%,transparent)]';
		default:
			return 'border-muted text-muted-foreground bg-transparent';
	}
}

type StatusFilter = 'ALL' | RunStatus;

export function RunsPage() {
	const { projectId } = useParams();
	const pid = projectId ?? 'demo';

	const { apiKey, hasApiKey } = useAuth();

	const [items, setItems] = React.useState<RunListItem[]>([]);
	const [nextCursor, setNextCursor] = React.useState<string | null>(null);

	const [loading, setLoading] = React.useState(true);
	const [loadingMore, setLoadingMore] = React.useState(false);

	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);
	const [projectName, setProjectName] = React.useState<string | null>(null);
	// Delete state
	const [deleting, setDeleting] = React.useState<string | null>(null);
	const [confirmRun, setConfirmRun] = React.useState<RunListItem | null>(null);
	const [confirmRunFinal, setConfirmRunFinal] =
		React.useState<RunListItem | null>(null);
	// Minimal “query params” state (no heavy UI)
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
	const [createOpen, setCreateOpen] = React.useState(false);
	const [creating, setCreating] = React.useState(false);
	const [createError, setCreateError] = React.useState<string | null>(null);
	const [form, setForm] = React.useState<{
		source: string;
		branch: string;
		commitSha: string;
		resultsJson: string;
	}>(() => ({
		source: 'manual',
		branch: 'main',
		commitSha: '',
		resultsJson: '',
	}));

	// Tune this as you like (typed!)
	const limit: NonNullable<ListRunsQuery>['limit'] = 10;

	function resetForm() {
		setForm({
			source: 'manual',
			branch: 'main',
			commitSha: '',
			resultsJson: '',
		});
		setCreateError(null);
	}

	function parseResultsInput(input: string): BatchResultsRequest | null {
		const trimmed = input.trim();
		if (!trimmed) return null;
		const parsed = JSON.parse(trimmed) as unknown;
		if (Array.isArray(parsed))
			return { results: parsed } as BatchResultsRequest;
		if (
			parsed &&
			typeof parsed === 'object' &&
			Array.isArray((parsed as BatchResultsRequest).results)
		) {
			return parsed as BatchResultsRequest;
		}
		throw new Error('Results must be a JSON array or { "results": [...] }.');
	}

	const refresh = React.useCallback(async () => {
		// If not authed, keep UI clean + stop here.
		if (!hasApiKey) {
			setItems([]);
			setNextCursor(null);
			setLoading(false);
			setError(null);
			setLastError(null);
			return;
		}

		setLoading(true);
		setError(null);
		setLastError(null);

		try {
			const data = await listRuns(pid, {
				limit,
				status: statusFilter === 'ALL' ? undefined : statusFilter,
				cursor: undefined, // first page
			});
			setItems(data.items);
			setNextCursor(data.nextCursor);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}, [pid, hasApiKey, limit, statusFilter]);

	React.useEffect(() => {
		void refresh();
	}, [refresh, apiKey]);

	React.useEffect(() => {
		if (!projectId || !hasApiKey) {
			setProjectName(null);
			return;
		}
		let cancelled = false;
		getProject(projectId)
			.then((project) => {
				if (cancelled) return;
				setProjectName(project.name);
			})
			.catch(() => {
				if (cancelled) return;
				setProjectName(null);
			});
		return () => {
			cancelled = true;
		};
	}, [projectId, hasApiKey]);

	async function onCreateRun() {
		if (!hasApiKey) return;
		setCreateOpen(true);
	}

	async function onSubmitCreateRun() {
		if (!hasApiKey) return;
		setCreating(true);
		setCreateError(null);
		setLastError(null);
		setError(null);

		try {
			const payload: CreateRunRequest = {
				source: form.source.trim() || 'manual',
				branch: form.branch.trim() || undefined,
				commitSha: form.commitSha.trim() || undefined,
			};
			const run = await createRun(pid, payload);
			const resultsPayload = parseResultsInput(form.resultsJson);
			if (resultsPayload) {
				await batchIngestResults(pid, run.id, resultsPayload);
			}
			await refresh();
			setCreateOpen(false);
			resetForm();
		} catch (e) {
			setLastError(e);
			setCreateError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setCreating(false);
		}
	}

	async function onLoadMore() {
		if (!hasApiKey) return;
		if (!nextCursor) return;

		setLoadingMore(true);
		setError(null);
		setLastError(null);

		try {
			const data = await listRuns(pid, {
				limit,
				status: statusFilter === 'ALL' ? undefined : statusFilter,
				cursor: nextCursor,
			});

			setItems((prev) => [...prev, ...data.items]);
			setNextCursor(data.nextCursor);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoadingMore(false);
		}
	}

	async function onDeleteRun(run: RunListItem) {
		if (!hasApiKey) return;
		setConfirmRun(run);
	}

	async function onConfirmDeleteRun(run: RunListItem) {
		if (!hasApiKey) return;

		setConfirmRunFinal(null);
		setDeleting(run.id);
		setError(null);
		setLastError(null);

		try {
			await deleteRun(pid, run.id);
			await refresh();
		} catch (e) {
			setLastError(e);
			if (e instanceof ApiError) {
				setError(`Failed to delete run: ${e.message}`);
			} else if (e instanceof Error) {
				setError(`Failed to delete run: ${e.message}`);
			} else {
				setError('Failed to delete run');
			}
		} finally {
			setDeleting(null);
		}
	}

	const showAuthCallout =
		!hasApiKey || (lastError instanceof ApiError && lastError.status === 401);

	return (
		<div className='space-y-4'>
			{confirmRun ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
					<div className='w-full max-w-xl rounded-lg border bg-muted dark:bg-muted p-5 shadow-lg'>
						<div className='flex items-start justify-between gap-4'>
							<div>
								<h2 className='text-base font-semibold'>Delete run</h2>
								<p className='text-xs text-muted-foreground'>
									This will permanently remove the run and its results.
								</p>
							</div>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => setConfirmRun(null)}>
								Close
							</Button>
						</div>

						<div className='mt-4 space-y-2 text-sm'>
							<div className='flex items-center justify-between'>
								<span className='font-medium'>{confirmRun.id}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Created</span>
								<span className='font-medium'>
									{formatDate(confirmRun.createdAt)}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Status</span>
								<span className='font-medium'>{confirmRun.status}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Total Tests</span>
								<span className='font-medium'>{confirmRun.totalCount}</span>
							</div>
							<div className='text-xs text-muted-foreground'>
								All {confirmRun.totalCount} test results in this run will be
								permanently deleted.
							</div>
						</div>

						<div className='mt-6 flex items-center justify-end gap-2'>
							<Button
								variant='outline'
								onClick={() => setConfirmRun(null)}
								disabled={deleting === confirmRun.id}>
								Cancel
							</Button>
							<Button
								variant='destructive'
								onClick={() => {
									setConfirmRunFinal(confirmRun);
									setConfirmRun(null);
								}}
								disabled={deleting === confirmRun.id}
								className='bg-destructive/70'>
								Continue
							</Button>
						</div>
					</div>
				</div>
			) : null}
			{confirmRunFinal ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
					<div className='w-full max-w-xl rounded-lg border bg-muted dark:bg-muted p-5 shadow-lg'>
						<div className='flex items-start justify-between gap-4'>
							<div>
								<h2 className='text-base font-semibold'>Confirm delete</h2>
								<p className='text-xs text-muted-foreground'>
									Are you really sure you want to delete this run? This is
									permanent.
								</p>
							</div>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => setConfirmRunFinal(null)}>
								Close
							</Button>
						</div>

						<div className='mt-4 space-y-2 text-sm'>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Run ID</span>
								<span className='font-medium'>{confirmRunFinal.id}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Created</span>
								<span className='font-medium'>
									{formatDate(confirmRunFinal.createdAt)}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Status</span>
								<span className='font-medium'>{confirmRunFinal.status}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Total Tests</span>
								<span className='font-medium'>
									{confirmRunFinal.totalCount}
								</span>
							</div>
						</div>

						<div className='mt-6 flex items-center justify-end gap-2'>
							<Button
								variant='outline'
								onClick={() => setConfirmRunFinal(null)}
								disabled={deleting === confirmRunFinal.id}>
								Cancel
							</Button>
							<Button
								variant='destructive'
								onClick={() => void onConfirmDeleteRun(confirmRunFinal)}
								disabled={deleting === confirmRunFinal.id}
								className='bg-destructive/70'>
								Yes, delete
							</Button>
						</div>
					</div>
				</div>
			) : null}
			<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h1 className='text-xl font-semibold'>Runs</h1>
					<p className='text-sm text-muted-foreground'>
						Latest runs for{' '}
						<span className='font-medium'>
							{projectName ?? projectId ?? pid}
						</span>
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-2'>
					<label className='text-xs text-muted-foreground'>Status</label>
					<select
						className='h-9 rounded-md border bg-background px-3 text-sm'
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
						disabled={loading || !hasApiKey}>
						<option value='ALL'>All</option>
						<option value='QUEUED'>QUEUED</option>
						<option value='RUNNING'>RUNNING</option>
						<option value='COMPLETED'>COMPLETED</option>
						<option value='FAILED'>FAILED</option>
						<option value='CANCELED'>CANCELED</option>
					</select>

					<Button
						onClick={onCreateRun}
						disabled={loading || !hasApiKey}
						className='transition-shadow hover:shadow-md'>
						Create Run
					</Button>
				</div>
			</div>

			{createOpen ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
					<div className='w-full max-w-2xl rounded-lg border bg-muted dark:bg-muted p-5 shadow-lg'>
						<div className='flex items-center justify-between gap-4'>
							<div>
								<h2 className='text-base font-semibold'>Create run</h2>
								<p className='text-xs text-muted-foreground'>
									Add a run and optionally ingest results to create tests.
								</p>
							</div>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => {
									setCreateOpen(false);
									resetForm();
								}}>
								Close
							</Button>
						</div>

						<div className='mt-4 grid gap-3 sm:grid-cols-2'>
							<div className='space-y-1'>
								<label className='text-xs font-medium'>Source</label>
								<Input
									value={form.source}
									onChange={(e) =>
										setForm((prev) => ({
											...prev,
											source: e.target.value,
										}))
									}
									placeholder='manual'
								/>
							</div>
							<div className='space-y-1'>
								<label className='text-xs font-medium'>Branch</label>
								<Input
									value={form.branch}
									onChange={(e) =>
										setForm((prev) => ({
											...prev,
											branch: e.target.value,
										}))
									}
									placeholder='main'
								/>
							</div>
							<div className='space-y-1 sm:col-span-2'>
								<label className='text-xs font-medium'>Commit SHA</label>
								<Input
									value={form.commitSha}
									onChange={(e) =>
										setForm((prev) => ({
											...prev,
											commitSha: e.target.value,
										}))
									}
									placeholder='deadbeef'
								/>
							</div>
						</div>

						<div className='mt-4 space-y-2'>
							<label className='text-xs font-medium'>
								Results JSON (optional)
							</label>
							<textarea
								value={form.resultsJson}
								onChange={(e) =>
									setForm((prev) => ({
										...prev,
										resultsJson: e.target.value,
									}))
								}
								placeholder='[{"externalId":"hw-cpu","name":"Hardware CPU check","suiteName":"Hardware","status":"PASSED","durationMs":120}]'
								className='min-h-[160px] w-full rounded-md border bg-background px-3 py-2 text-xs font-mono text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
							/>
							<p className='text-xs text-muted-foreground'>
								Paste a JSON array of results or an object with a “results”
								field. Each item needs externalId, name, and status
								(PASSED/FAILED/SKIPPED/ERROR).
							</p>
							{createError ? (
								<p className='text-xs text-destructive'>{createError}</p>
							) : null}
						</div>

						<div className='mt-5 flex items-center justify-end gap-2'>
							<Button
								variant='outline'
								onClick={() => {
									setCreateOpen(false);
									resetForm();
								}}
								disabled={creating}>
								Cancel
							</Button>
							<Button onClick={onSubmitCreateRun} disabled={creating}>
								{creating ? 'Creating…' : 'Create run'}
							</Button>
						</div>
					</div>
				</div>
			) : null}

			{showAuthCallout ? <AuthRequiredCallout /> : null}

			{error ? (
				<PageError
					title='Runs'
					message={error}
					onRetry={() => void refresh()}
				/>
			) : loading ? (
				<PageLoading title='Runs' />
			) : !hasApiKey ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					Set an API key in Settings to view runs.
				</div>
			) : items.length === 0 ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					No runs yet. Click “Create Run”.
				</div>
			) : (
				<>
					<div className='overflow-hidden rounded-md border'>
						<div className='grid grid-cols-14 gap-2 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground'>
							<div className='col-span-3'>Created</div>
							<div className='col-span-2'>Status</div>
							<div className='col-span-3'>Branch / Commit</div>
							<div className='col-span-2'>Totals</div>
							<div className='col-span-2'>Run ID</div>
							<div className='col-span-2 text-right'>Actions</div>
						</div>

						<div className='max-h-[520px] divide-y overflow-y-auto'>
							{items.map((r) => (
								<div
									key={r.id}
									className='grid grid-cols-14 items-center gap-2 px-4 py-3 text-sm'>
									<div className='col-span-3'>{formatDate(r.createdAt)}</div>

									<div className='col-span-2'>
										<Badge
											variant='outline'
											className={runStatusBadgeClass(r.status)}>
											{r.status}
										</Badge>
									</div>

									<div className='col-span-3 truncate text-muted-foreground'>
										{r.branch ?? '—'} {r.commitSha ? `• ${r.commitSha}` : ''}
									</div>

									<div className='col-span-2 text-muted-foreground'>
										{r.passedCount}/{r.totalCount} passed
									</div>

									<div className='col-span-2 truncate font-mono text-xs text-muted-foreground'>
										{r.id}
									</div>

									<div className='col-span-2 flex justify-end gap-2'>
										<Button variant='outline' size='sm' asChild>
											<Link to={`/projects/${pid}/runs/${r.id}`}>View</Link>
										</Button>
										<Button
											variant='secondary'
											size='sm'
											onClick={() => onDeleteRun(r)}
											disabled={deleting === r.id}
											className='hover:bg-destructive/20 hover:text-destructive dark:bg-secondary/80'>
											{deleting === r.id ? 'Deleting…' : 'Delete'}
										</Button>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className='flex items-center justify-end'>
						<Button
							variant='secondary'
							onClick={onLoadMore}
							disabled={!hasApiKey || loadingMore || !nextCursor}
							className='transition-shadow hover:shadow-md'>
							{nextCursor
								? loadingMore
									? 'Loading…'
									: 'Load more'
								: 'No more'}
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
