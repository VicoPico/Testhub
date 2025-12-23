import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
	getRun,
	listRunResults,
	type RunDetails,
	type RunResultItem,
	type RunStatus,
} from '@/lib/api';

function statusBadgeVariant(status: RunStatus) {
	switch (status) {
		case 'COMPLETED':
			return 'default';
		case 'FAILED':
			return 'destructive';
		case 'RUNNING':
			return 'secondary';
		case 'QUEUED':
			return 'secondary';
		case 'CANCELED':
			return 'outline';
		default:
			return 'secondary';
	}
}

export function RunDetailsPage() {
	const { projectId, runId } = useParams();
	const pid = projectId ?? 'demo';

	const [run, setRun] = React.useState<RunDetails | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [results, setResults] = React.useState<RunResultItem[]>([]);

	React.useEffect(() => {
		if (!projectId || !runId) return;

		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(null);

			try {
				const [runData, resultsData] = await Promise.all([
					getRun(projectId, runId),
					listRunResults(projectId, runId),
				]);

				if (cancelled) return;

				setRun(runData);
				setResults(resultsData.items);
			} catch (e) {
				if (cancelled) return;
				setError(e instanceof Error ? e.message : 'Unknown error');
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();

		return () => {
			cancelled = true;
		};
	}, [projectId, runId]);

	if (!runId) {
		return (
			<div className='space-y-3'>
				<h1 className='text-xl font-semibold'>Run details</h1>
				<p className='text-sm text-muted-foreground'>
					Missing route params. Check your router path.
				</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className='space-y-4'>
				<div className='flex items-center justify-between gap-3'>
					<div className='space-y-1'>
						<div className='h-7 w-56 rounded bg-muted' />
						<div className='h-4 w-40 rounded bg-muted' />
					</div>
					<div className='h-9 w-32 rounded bg-muted' />
				</div>
				<div className='h-40 rounded-lg border bg-card' />
				<div className='h-64 rounded-lg border bg-card' />
			</div>
		);
	}

	if (error) {
		return (
			<div className='space-y-3'>
				<h1 className='text-xl font-semibold'>Run details</h1>
				<p className='text-sm text-destructive'>{error}</p>
				<Button asChild variant='outline' size='sm'>
					<Link to={`/projects/${pid}/runs`}>Back to runs</Link>
				</Button>
			</div>
		);
	}

	if (!run) {
		return (
			<div className='space-y-3'>
				<h1 className='text-xl font-semibold'>Run details</h1>
				<p className='text-sm text-muted-foreground'>Run not found.</p>
				<Button asChild variant='outline' size='sm'>
					<Link to={`/projects/${pid}/runs`}>Back to runs</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex items-start justify-between gap-4'>
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<h1 className='text-xl font-semibold tracking-tight'>
							Run{' '}
							<span className='font-mono text-base text-muted-foreground'>
								{run.id}
							</span>
						</h1>
						<Badge variant={statusBadgeVariant(run.status)}>{run.status}</Badge>
					</div>
					<p className='text-sm text-muted-foreground'>
						Project: <span className='font-mono'>{run.projectId}</span>
					</p>
				</div>

				<Button asChild variant='outline' size='sm'>
					<Link to={`/projects/${pid}/runs`}>Back to runs</Link>
				</Button>
			</div>

			{/* Summary card */}
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

			{/* Results placeholder (next) */}
			<div className='rounded-lg border bg-card p-4'>
				<div className='flex items-center justify-between gap-3'>
					<h2 className='text-sm font-semibold'>Results</h2>
					<p className='text-xs text-muted-foreground'>
						{results.length} tests
					</p>
				</div>

				<Separator className='my-3' />

				{results.length === 0 ? (
					<p className='text-sm text-muted-foreground'>
						No results yet for this run.
					</p>
				) : (
					<div className='space-y-2'>
						{results.map((r) => (
							<div
								key={r.id}
								className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'>
								<div className='min-w-0'>
									<div className='truncate text-sm font-medium'>
										{r.testCase.name}
									</div>
									<div className='truncate text-xs text-muted-foreground'>
										{r.testCase.externalId}
									</div>
								</div>

								<div className='flex items-center gap-2'>
									<Badge
										variant={
											r.status === 'FAILED' ? 'destructive' : 'secondary'
										}>
										{r.status}
									</Badge>
								</div>
							</div>
						))}
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
