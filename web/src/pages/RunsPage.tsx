import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { listRuns, createRun, type RunListItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

	const [items, setItems] = React.useState<RunListItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	async function refresh() {
		setLoading(true);
		setError(null);
		try {
			const data = await listRuns(pid);
			setItems(data.items);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}

	React.useEffect(() => {
		void refresh();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pid]);

	async function onCreateRun() {
		try {
			await createRun(pid);
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Unknown error');
		}
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>Runs</h1>
					<p className='text-sm text-muted-foreground'>
						Latest runs for <span className='font-medium'>{pid}</span>
					</p>
				</div>

				<Button onClick={onCreateRun}>Create Run (demo)</Button>
			</div>

			{error && (
				<div className='rounded-md border p-3 text-sm text-destructive'>
					{error}
				</div>
			)}

			{loading ? (
				<div className='text-sm text-muted-foreground'>Loading…</div>
			) : items.length === 0 ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					No runs yet. Click “Create Run (demo)”.
				</div>
			) : (
				<div className='rounded-md border overflow-hidden'>
					<div className='grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40'>
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
								className='grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center'>
								<div className='col-span-3'>{formatDate(r.createdAt)}</div>

								<div className='col-span-2'>
									<Badge variant={statusVariant(r.status)}>{r.status}</Badge>
								</div>

								<div className='col-span-3 text-muted-foreground truncate'>
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
