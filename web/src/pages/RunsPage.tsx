import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { listRuns, createRun, ApiError, type RunListItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageError, PageLoading } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';
import { useAuth } from '@/lib/useAuth';

function formatDate(iso: string) {
	const d = new Date(iso);
	return d.toLocaleString();
}

function statusVariant(
	status: RunListItem['status']
): 'default' | 'secondary' | 'destructive' {
	if (status === 'FAILED') return 'destructive';
	if (status === 'COMPLETED') return 'default';
	return 'secondary';
}

export function RunsPage() {
	const { projectId } = useParams();
	const pid = projectId ?? 'demo';

	const { apiKey, hasApiKey } = useAuth();

	const [items, setItems] = React.useState<RunListItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	const refresh = React.useCallback(async () => {
		// If not authed, keep UI clean + stop here.
		if (!hasApiKey) {
			setItems([]);
			setLoading(false);
			setError(null);
			setLastError(null);
			return;
		}

		setLoading(true);
		setError(null);
		setLastError(null);

		try {
			const data = await listRuns(pid);
			setItems(data.items);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}, [pid, hasApiKey]);

	// Re-fetch when:
	// - project changes
	// - key changes (set/clear)
	React.useEffect(() => {
		void refresh();
	}, [refresh, apiKey]);

	async function onCreateRun() {
		if (!hasApiKey) return;

		setError(null);
		setLastError(null);

		try {
			await createRun(pid);
			await refresh();
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		}
	}

	const showAuthCallout =
		!hasApiKey || (lastError instanceof ApiError && lastError.status === 401);

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>Runs</h1>
					<p className='text-sm text-muted-foreground'>
						Latest runs for <span className='font-medium'>{pid}</span>
					</p>
				</div>

				<Button onClick={onCreateRun} disabled={loading || !hasApiKey}>
					Create Run
				</Button>
			</div>

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
				<div className='overflow-hidden rounded-md border'>
					<div className='grid grid-cols-12 gap-2 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground'>
						<div className='col-span-3'>Created</div>
						<div className='col-span-2'>Status</div>
						<div className='col-span-3'>Branch / Commit</div>
						<div className='col-span-2'>Totals</div>
						<div className='col-span-2 text-right'>Action</div>
					</div>

					<div className='divide-y'>
						{items.map((r) => (
							<div
								key={r.id}
								className='grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm'>
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

								<div className='col-span-2 text-right'>
									<Link
										className='text-sm underline underline-offset-4 hover:text-foreground'
										to={`/projects/${pid}/runs/${r.id}`}>
										View details →
									</Link>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
