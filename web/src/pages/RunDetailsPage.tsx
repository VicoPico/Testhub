import * as React from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import {
	ApiError,
	getRun,
	listRunResults,
	type RunDetails,
	type RunResultItem,
	type TestStatus,
} from '@/lib/api';

import { PageError } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';
import { useAuth } from '@/lib/useAuth';

function runStatusBadgeClass(status: RunDetails['status']) {
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

function testStatusBadgeClass(status: TestStatus) {
	switch (status) {
		case 'PASSED':
			return 'border-[color:var(--test-passed)] text-[color:var(--test-passed)] bg-[color-mix(in_oklch,var(--test-passed)_16%,transparent)]';
		case 'FAILED':
			return 'border-[color:var(--test-failed)] text-[color:var(--test-failed)] bg-[color-mix(in_oklch,var(--test-failed)_16%,transparent)]';
		case 'ERROR':
			return 'border-[color:var(--test-error)] text-[color:var(--test-error)] bg-[color-mix(in_oklch,var(--test-error)_16%,transparent)]';
		case 'SKIPPED':
			return 'border-[color:var(--test-skipped)] text-[color:var(--test-skipped)] bg-[color-mix(in_oklch,var(--test-skipped)_16%,transparent)]';
		default:
			return 'border-muted text-muted-foreground bg-transparent';
	}
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleString();
}

function formatDuration(ms?: number | null) {
	if (ms == null) return '—';
	if (ms < 1000) return `${ms} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}

type StatusFilter = 'ALL' | TestStatus;

export function RunDetailsPage() {
	const { projectId, runId } = useParams();
	const pid = projectId ?? '';
	const rid = runId ?? '';

	const { hasApiKey } = useAuth();

	const [run, setRun] = React.useState<RunDetails | null>(null);
	const [results, setResults] = React.useState<RunResultItem[]>([]);
	const [loading, setLoading] = React.useState(true);

	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');

	const isUnauthorized =
		lastError instanceof ApiError && lastError.status === 401;

	const refresh = React.useCallback(async () => {
		if (!pid || !rid) return;

		setLoading(true);
		setError(null);
		setLastError(null);

		try {
			const [runData, resultsData] = await Promise.all([
				getRun(pid, rid),
				listRunResults(pid, rid),
			]);

			setRun(runData);
			setResults(resultsData.items);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}, [pid, rid]);

	React.useEffect(() => {
		// route params missing -> do nothing
		if (!pid || !rid) return;

		// if no key, don't fetch and don't show skeleton forever
		if (!hasApiKey) {
			setRun(null);
			setResults([]);
			setLastError(null);
			setError(null);
			setLoading(false);
			return;
		}

		void refresh();
	}, [pid, rid, hasApiKey, refresh]);

	const filteredResults =
		statusFilter === 'ALL'
			? results
			: results.filter((r) => r.status === statusFilter);

	const counts = React.useMemo(() => {
		const c = { PASSED: 0, FAILED: 0, SKIPPED: 0, ERROR: 0 } as Record<
			TestStatus,
			number
		>;
		for (const r of results) c[r.status] += 1;
		return c;
	}, [results]);

	if (!pid || !rid) {
		return (
			<div className='space-y-3'>
				<h1 className='text-xl font-semibold'>Run details</h1>
				<p className='text-sm text-muted-foreground'>
					Missing route params. Check your router path.
				</p>
			</div>
		);
	}

	// Auth gating (no key or 401)
	if (!hasApiKey || isUnauthorized) {
		return (
			<div className='space-y-4'>
				<div className='flex items-center justify-between gap-3'>
					<div>
						<h1 className='text-xl font-semibold'>Run details</h1>
						<p className='text-sm text-muted-foreground'>
							This endpoint is protected.
						</p>
					</div>

					<Button asChild variant='outline' size='sm'>
						<Link to={`/projects/${pid}/runs`}>Back to runs</Link>
					</Button>
				</div>

				<AuthRequiredCallout />
			</div>
		);
	}

	if (loading) {
		return (
			<div className='space-y-4'>
				<div className='flex items-center justify-between gap-3'>
					<div className='space-y-1'>
						<div className='h-7 w-64 rounded bg-muted' />
						<div className='h-4 w-48 rounded bg-muted' />
					</div>
					<div className='h-9 w-28 rounded bg-muted' />
				</div>
				<div className='h-36 rounded-lg border bg-card' />
				<div className='h-72 rounded-lg border bg-card' />
			</div>
		);
	}

	if (error) {
		return (
			<PageError
				title='Run details'
				message={error}
				onRetry={() => void refresh()}
				extra={
					<div className='flex gap-2'>
						<Button asChild variant='outline' size='sm'>
							<Link to={`/projects/${pid}/runs`}>Back to runs</Link>
						</Button>
					</div>
				}
			/>
		);
	}

	if (!run) return null;

	return (
		<div className='space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<h1 className='text-xl font-semibold tracking-tight'>
							Run{' '}
							<span className='font-mono text-base text-muted-foreground'>
								{run.id}
							</span>
						</h1>
						<Badge
							variant='outline'
							className={runStatusBadgeClass(run.status)}>
							{run.status}
						</Badge>
					</div>
					<p className='text-sm text-muted-foreground'>
						Created {formatDate(run.createdAt)} • Project{' '}
						<span className='font-mono'>{pid}</span>
					</p>
				</div>

				<div className='flex gap-2'>
					<Button variant='secondary' size='sm' onClick={() => void refresh()}>
						Refresh
					</Button>
					<Button asChild variant='outline' size='sm'>
						<Link to={`/projects/${pid}/runs`}>Back</Link>
					</Button>
				</div>
			</div>

			<div className='rounded-lg border bg-card p-4'>
				<div className='grid gap-3 md:grid-cols-3'>
					<div>
						<div className='text-xs font-medium text-muted-foreground'>
							Source
						</div>
						<div className='text-sm'>{run.source ?? '—'}</div>
					</div>
					<div>
						<div className='text-xs font-medium text-muted-foreground'>
							Branch
						</div>
						<div className='text-sm font-mono'>{run.branch ?? '—'}</div>
					</div>
					<div>
						<div className='text-xs font-medium text-muted-foreground'>
							Commit
						</div>
						<div className='text-sm font-mono'>{run.commitSha ?? '—'}</div>
					</div>
				</div>

				<Separator className='my-4' />

				<div className='grid gap-3 md:grid-cols-5'>
					<Stat label='Total' value={run.totalCount} />
					<Stat label='Passed' value={run.passedCount} />
					<Stat label='Failed' value={run.failedCount} />
					<Stat label='Skipped' value={run.skippedCount} />
					<Stat label='Errors' value={run.errorCount} />
				</div>
			</div>

			<div className='rounded-lg border bg-card p-4'>
				<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
					<div>
						<h2 className='text-sm font-semibold'>Results</h2>
						<p className='text-xs text-muted-foreground'>
							{results.length} total • {counts.PASSED} passed • {counts.FAILED}{' '}
							failed • {counts.SKIPPED} skipped • {counts.ERROR} errors
						</p>
					</div>

					<div className='flex items-center gap-2'>
						<span className='text-xs text-muted-foreground'>Filter</span>
						<Select
							value={statusFilter}
							onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
							<SelectTrigger className='h-9 w-[180px]'>
								<SelectValue placeholder='All statuses' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='ALL'>All</SelectItem>
								<SelectItem value='PASSED'>Passed</SelectItem>
								<SelectItem value='FAILED'>Failed</SelectItem>
								<SelectItem value='SKIPPED'>Skipped</SelectItem>
								<SelectItem value='ERROR'>Error</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<Separator className='my-3' />

				{filteredResults.length === 0 ? (
					<div className='rounded-md border p-6 text-sm text-muted-foreground'>
						{results.length === 0
							? 'No results yet for this run.'
							: 'No results match the current filter.'}
					</div>
				) : (
					<div className='overflow-hidden rounded-md border'>
						<div className='grid grid-cols-12 gap-2 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground'>
							<div className='col-span-2'>Status</div>
							<div className='col-span-6'>Test</div>
							<div className='col-span-2'>Duration</div>
							<div className='col-span-2'>Message</div>
						</div>

						<div className='divide-y'>
							{filteredResults.map((r) => {
								const showMsg = r.status === 'FAILED' || r.status === 'ERROR';
								return (
									<div key={r.id} className='px-4 py-3'>
										<div className='grid grid-cols-12 items-start gap-2'>
											<div className='col-span-2'>
												<Badge
													variant='outline'
													className={testStatusBadgeClass(r.status)}>
													{r.status}
												</Badge>
											</div>

											<div className='col-span-6 min-w-0'>
												<div className='truncate font-medium'>
													{r.testCase.name}
												</div>
												<div className='truncate text-xs text-muted-foreground'>
													{r.testCase.suiteName ?? r.testCase.externalId}
												</div>

												{r.testCase.tags?.length ? (
													<div className='mt-2 flex flex-wrap gap-1'>
														{r.testCase.tags.slice(0, 8).map((t) => (
															<span
																key={t}
																className='rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground'>
																{t}
															</span>
														))}
														{r.testCase.tags.length > 8 && (
															<span className='text-[11px] text-muted-foreground'>
																+{r.testCase.tags.length - 8}
															</span>
														)}
													</div>
												) : null}
											</div>

											<div className='col-span-2 text-sm text-muted-foreground'>
												{formatDuration(r.durationMs)}
											</div>

											<div className='col-span-2 text-xs text-muted-foreground'>
												{showMsg && r.message ? (
													<span className='line-clamp-2'>{r.message}</span>
												) : (
													<span>—</span>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function Stat(props: { label: string; value: number }) {
	return (
		<div className='rounded-md bg-muted/40 px-3 py-2'>
			<div className='text-[11px] font-medium text-muted-foreground'>
				{props.label}
			</div>
			<div className='text-lg font-semibold leading-tight'>{props.value}</div>
		</div>
	);
}
