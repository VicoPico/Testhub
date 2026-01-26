import * as React from 'react';
import { Link, useParams } from 'react-router-dom';

import {
	listRuns,
	createRun,
	batchIngestResults,
	deleteRun,
	ApiError,
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

function statusVariant(
	status: RunListItem['status'],
): 'default' | 'secondary' | 'destructive' {
	if (status === 'FAILED') return 'destructive';
	if (status === 'COMPLETED') return 'default';
	return 'secondary';
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
	// Delete state
	const [deleting, setDeleting] = React.useState<string | null>(null);
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

		const confirmed = window.confirm(
			`Are you sure you want to delete this run?\n\n` +
				`Run ID: ${run.id}\n` +
				`Created: ${formatDate(run.createdAt)}\n` +
				`Status: ${run.status}\n` +
				`Total Tests: ${run.totalCount}\n\n` +
				`⚠️ WARNING: This will permanently delete:\n` +
				`• This test run\n` +
				`• All ${run.totalCount} test results in this run\n\n` +
				`This action cannot be undone.`,
		);

		if (!confirmed) return;

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
			<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h1 className='text-xl font-semibold'>Runs</h1>
					<p className='text-sm text-muted-foreground'>
						Latest runs for <span className='font-medium'>{pid}</span>
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

					<Button onClick={onCreateRun} disabled={loading || !hasApiKey}>
						Create Run
					</Button>
				</div>
			</div>

			{createOpen ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
					<div className='w-full max-w-2xl rounded-lg border bg-background p-5 shadow-lg'>
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
								variant='secondary'
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
										<Badge variant={statusVariant(r.status)}>{r.status}</Badge>
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
										<Link
											className='text-sm underline underline-offset-4 hover:text-foreground'
											to={`/projects/${pid}/runs/${r.id}`}>
											View
										</Link>
										<Button
											variant='outline'
											size='sm'
											onClick={() => onDeleteRun(r)}
											disabled={deleting === r.id}
											className='text-destructive hover:text-destructive'>
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
							disabled={!hasApiKey || loadingMore || !nextCursor}>
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
