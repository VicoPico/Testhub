//TestsPage.tsx

import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/lib/useAuth';
import {
	ApiError,
	listTests,
	getTestHistory,
	type TestCaseListItem,
	type TestStatus,
} from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { PageError, PageLoading } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';
import { ScrollableList } from '@/components/common/ScrollableList';
import {
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	RadialBar,
	RadialBarChart,
} from 'recharts';

type StatusFilter = 'ALL' | TestStatus;

function formatDate(iso: string) {
	return new Date(iso).toLocaleString();
}

function testStatusBadgeClass(status?: StatusFilter | null) {
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

export function TestsPage() {
	const { projectId } = useParams();
	const pid = projectId ?? 'demo';
	const [searchParams, setSearchParams] = useSearchParams();
	const { apiKey, hasApiKey } = useAuth();

	const [items, setItems] = React.useState<TestCaseListItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [hasLoaded, setHasLoaded] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	// NOTE: q is local state (keeps input stable while typing).
	// We sync it to URL with a debounce, and we also sync it FROM URL when navigation changes.
	const [q, setQ] = React.useState(() => searchParams.get('q') ?? '');
	const [suite, setSuite] = React.useState('');
	const [status, setStatus] = React.useState<StatusFilter>('ALL');

	const [selected, setSelected] = React.useState<TestCaseListItem | null>(null);
	const [historyLoading, setHistoryLoading] = React.useState(false);
	const [historyError, setHistoryError] = React.useState<string | null>(null);
	const [history, setHistory] = React.useState<
		Array<{
			id: string;
			status: TestStatus;
			durationMs: number | null;
			createdAt: string;
			run: {
				id: string;
				createdAt: string;
				status: string;
				branch: string | null;
				commitSha: string | null;
			};
		}>
	>([]);

	const refresh = React.useCallback(async () => {
		if (!hasApiKey) {
			setItems([]);
			setSelected(null);
			setLoading(false);
			setIsRefreshing(false);
			setHasLoaded(false);
			setError(null);
			setLastError(null);
			return;
		}

		if (!hasLoaded) setLoading(true);
		else setIsRefreshing(true);
		setError(null);
		setLastError(null);

		try {
			const data = await listTests(pid, {
				limit: 100,
				q: q.trim() ? q.trim() : undefined,
				suite: suite.trim() ? suite.trim() : undefined,
				status: status === 'ALL' ? undefined : status,
			});
			setItems(data.items);
			setHasLoaded(true);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
			setIsRefreshing(false);
		}
	}, [hasApiKey, pid, q, suite, status, hasLoaded]);

	React.useEffect(() => {
		void refresh();
	}, [refresh, apiKey]);

	// 1) Sync q FROM the URL when the location changes (e.g. user clicks a link that sets ?q=...).
	// Avoid clobbering while the user is actively focused in the input (prevents cursor jumps).
	React.useEffect(() => {
		const urlQ = searchParams.get('q') ?? '';
		if (urlQ === q) return;

		const activeId =
			typeof document !== 'undefined' ? document.activeElement?.id : undefined;

		// If user is typing in the q input, don't overwrite.
		if (activeId === 'tests-q') return;

		setQ(urlQ);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams]);

	// 2) Sync q TO the URL, but debounced, so we don't navigate on every keystroke (which loses focus).
	React.useEffect(() => {
		const handle = window.setTimeout(() => {
			const trimmed = q.trim();
			const current = searchParams.get('q') ?? '';
			if (trimmed === current) return;

			const next = new URLSearchParams(searchParams);
			if (trimmed) next.set('q', trimmed);
			else next.delete('q');

			setSearchParams(next, { replace: true });
		}, 300);

		return () => window.clearTimeout(handle);
	}, [q, searchParams, setSearchParams]);

	React.useEffect(() => {
		async function loadHistory() {
			if (!hasApiKey || !selected) return;
			setHistoryLoading(true);
			setHistoryError(null);
			try {
				const data = await getTestHistory(pid, selected.id, { limit: 50 });
				setHistory(data.items);
			} catch (e) {
				setHistory([]);
				if (e instanceof ApiError) setHistoryError(e.message);
				else if (e instanceof Error) setHistoryError(e.message);
				else setHistoryError('Failed to load history');
			} finally {
				setHistoryLoading(false);
			}
		}
		void loadHistory();
	}, [hasApiKey, pid, selected]);

	const showAuthCallout =
		!hasApiKey || (lastError instanceof ApiError && lastError.status === 401);

	const stats = React.useMemo(() => {
		let passed = 0,
			failed = 0,
			skipped = 0,
			errorCount = 0;
		let durationTotal = 0;
		let durationCount = 0;

		for (const h of history) {
			if (h.status === 'PASSED') passed++;
			else if (h.status === 'FAILED') failed++;
			else if (h.status === 'SKIPPED') skipped++;
			else errorCount++;

			if (typeof h.durationMs === 'number') {
				durationTotal += h.durationMs;
				durationCount++;
			}
		}

		const total = passed + failed + skipped + errorCount;
		const passRate = total ? Math.round((passed / total) * 100) : 0;
		const avgDurationMs = durationCount
			? Math.round(durationTotal / durationCount)
			: null;

		return {
			passed,
			failed,
			skipped,
			error: errorCount,
			total,
			passRate,
			avgDurationMs,
		};
	}, [history]);

	const passRateChartConfig: ChartConfig = {
		passed: {
			label: 'Passed',
			theme: { light: 'var(--test-passed)', dark: 'var(--test-passed)' },
		},
	};

	return (
		<div className='space-y-6'>
			<div>
				<h1 className='text-xl font-semibold'>Tests</h1>
				<p className='text-sm text-muted-foreground'>
					Explore test cases and their recent execution history.
				</p>
			</div>

			{showAuthCallout ? <AuthRequiredCallout /> : null}

			<div className='grid gap-3 md:grid-cols-3'>
				<div className='space-y-1'>
					<label className='text-xs font-medium' htmlFor='tests-q'>
						Name / External ID
					</label>
					<Input
						id='tests-q'
						placeholder='Search…'
						value={q}
						onChange={(e) => setQ(e.target.value)}
						disabled={!hasApiKey}
						className='transition-shadow hover:shadow-md hover:ring-1 hover:ring-ring/40 hover:bg-muted/40'
					/>
				</div>

				<div className='space-y-1'>
					<label className='text-xs font-medium' htmlFor='tests-suite'>
						Suite
					</label>
					<Input
						id='tests-suite'
						placeholder='e.g. auth, checkout…'
						value={suite}
						onChange={(e) => setSuite(e.target.value)}
						disabled={!hasApiKey}
						className='transition-shadow hover:shadow-md hover:ring-1 hover:ring-ring/40 hover:bg-muted/40'
					/>
				</div>

				<div className='space-y-1'>
					<label className='text-xs font-medium'>Last Status</label>
					<Select
						value={status}
						onValueChange={(v) => setStatus(v as StatusFilter)}
						disabled={!hasApiKey}>
						<SelectTrigger className='transition-shadow hover:shadow-md hover:ring-1 hover:ring-ring/40 hover:bg-muted/40'>
							<SelectValue placeholder='All' />
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

			<div className='flex items-center gap-2'>
				<Button
					variant='secondary'
					onClick={() => void refresh()}
					disabled={!hasApiKey}>
					Refresh
				</Button>
				<Button
					variant='outline'
					onClick={() => {
						setQ('');
						setSuite('');
						setStatus('ALL');
					}}
					disabled={!hasApiKey}>
					Clear filters
				</Button>
				{isRefreshing ? (
					<span className='text-xs text-muted-foreground'>Updating…</span>
				) : null}
			</div>

			{error ? (
				<PageError
					title='Tests'
					message={error}
					onRetry={() => void refresh()}
				/>
			) : loading ? (
				<PageLoading title='Tests' />
			) : !hasApiKey ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					Set an API key in Settings to view tests.
				</div>
			) : items.length === 0 ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					No tests found. Ingest a run with results to populate test cases.
				</div>
			) : (
				<div className='grid gap-4 lg:grid-cols-[1.2fr,0.8fr]'>
					<div className='overflow-hidden rounded-md border'>
						<div className='grid grid-cols-14 gap-2 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground'>
							<div className='col-span-4'>Name</div>
							<div className='col-span-3'>Suite</div>
							<div className='col-span-3'>Tags</div>
							<div className='col-span-2'>Last status</div>
							<div className='col-span-2 text-right'>Last seen</div>
						</div>

						<ScrollableList>
							{items.map((t) => {
								const isSelected = selected?.id === t.id;
								const last = (
									t as TestCaseListItem & {
										lastStatus?: TestStatus | null;
									}
								).lastStatus;
								const tags = t.tags ?? [];
								const visibleTags = tags.slice(0, 2);
								const extraCount = tags.length - visibleTags.length;
								return (
									<div
										key={t.id}
										tabIndex={0}
										role='button'
										onClick={() => setSelected(t)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												setSelected(t);
											}
										}}
										className={
											'grid grid-cols-14 items-center gap-2 px-4 py-3 text-sm cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ' +
											(isSelected ? 'bg-muted/30' : '')
										}>
										<div className='col-span-4 font-medium truncate'>
											{t.name}
											<div className='text-[11px] text-muted-foreground truncate'>
												{t.externalId}
											</div>
										</div>
										<div className='col-span-3 text-muted-foreground truncate'>
											{t.suiteName ?? '—'}
										</div>
										<div className='col-span-3'>
											{tags.length ? (
												<div className='flex flex-wrap gap-1'>
													{visibleTags.map((tag) => (
														<Badge
															key={tag}
															variant='secondary'
															className='px-1.5 py-0 text-[10px]'>
															{tag}
														</Badge>
													))}
													{extraCount > 0 ? (
														<Badge
															variant='secondary'
															className='px-1.5 py-0 text-[10px] text-muted-foreground'>
															+{extraCount}
														</Badge>
													) : null}
												</div>
											) : (
												<span className='text-xs text-muted-foreground'>—</span>
											)}
										</div>
										<div className='col-span-2'>
											<Badge
												variant='outline'
												className={testStatusBadgeClass(
													(last ?? 'ALL') as StatusFilter,
												)}>
												{last ? last : '—'}
											</Badge>
										</div>
										<div className='col-span-2 text-right text-muted-foreground text-xs'>
											{t.lastSeenAt ? formatDate(t.lastSeenAt) : '—'}
										</div>
									</div>
								);
							})}
						</ScrollableList>
					</div>

					<div className='rounded-md border p-4 space-y-3'>
						<h2 className='text-sm font-medium'>Details</h2>
						{!selected ? (
							<p className='text-sm text-muted-foreground'>
								Select a test to see its recent history.
							</p>
						) : (
							<div className='space-y-1'>
								<div className='flex items-start justify-between gap-4'>
									<div className='space-y-1'>
										<div className='text-sm font-medium'>{selected.name}</div>
										<div className='text-xs text-muted-foreground break-all'>
											{selected.externalId}
										</div>
										<div className='text-xs text-muted-foreground'>
											Suite: {selected.suiteName ?? '—'}
										</div>
										{selected.tags?.length ? (
											<div className='flex flex-wrap gap-1'>
												{selected.tags.map((tag) => (
													<Badge
														key={tag}
														variant='secondary'
														className='px-1.5 py-0 text-[10px]'>
														{tag}
													</Badge>
												))}
											</div>
										) : (
											<div className='text-xs text-muted-foreground'>
												Tags: —
											</div>
										)}
									</div>

									<div className='relative h-32 w-32 shrink-0'>
										<ChartContainer
											className='h-32 w-32'
											config={passRateChartConfig}>
											<RadialBarChart
												data={[
													{
														name: 'Passed',
														value: stats.passRate,
														fill: 'var(--color-passed)',
													},
												]}
												startAngle={90}
												endAngle={-270}
												innerRadius={50}
												outerRadius={65}>
												<PolarGrid
													gridType='circle'
													radialLines={false}
													stroke='var(--border)'
												/>
												<PolarAngleAxis
													type='number'
													domain={[0, 100]}
													dataKey='value'
													tick={false}
												/>
												<PolarRadiusAxis tick={false} axisLine={false} />
												<RadialBar
													dataKey='value'
													cornerRadius={12}
													background
												/>
											</RadialBarChart>
										</ChartContainer>
										<div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
											<div className='text-xl font-semibold'>
												{stats.passRate}%
											</div>
											<div className='text-[11px] text-muted-foreground'>
												Pass rate
											</div>
										</div>
									</div>
								</div>

								{historyError ? (
									<p className='text-xs text-destructive'>{historyError}</p>
								) : historyLoading ? (
									<p className='text-sm text-muted-foreground'>
										Loading history…
									</p>
								) : history.length === 0 ? (
									<p className='text-sm text-muted-foreground'>
										No history yet.
									</p>
								) : (
									<div className='space-y-3'>
										<div className='flex flex-wrap gap-2'>
											<Badge variant='secondary'>Last {stats.total}</Badge>
											<Badge variant='default'>
												Pass rate {stats.passRate}%
											</Badge>
											<Badge
												variant='outline'
												className={testStatusBadgeClass('FAILED')}>
												Failed {stats.failed + stats.error}
											</Badge>
											<Badge
												variant='outline'
												className={testStatusBadgeClass('SKIPPED')}>
												Skipped {stats.skipped}
											</Badge>
											{stats.avgDurationMs != null ? (
												<Badge variant='outline'>
													Avg {stats.avgDurationMs}ms
												</Badge>
											) : null}
										</div>

										<div className='space-y-2'>
											<div className='text-xs text-muted-foreground'>
												Recent results
											</div>
											<div className='space-y-1'>
												{history.slice(0, 12).map((h) => (
													<div
														key={h.id}
														className='flex items-center justify-between gap-2 text-xs'>
														<div className='flex items-center gap-2 min-w-0'>
															<Badge
																variant='outline'
																className={testStatusBadgeClass(h.status)}>
																{h.status}
															</Badge>
															<span className='text-muted-foreground truncate'>
																{formatDate(h.createdAt)}
															</span>
														</div>
														<div className='text-muted-foreground'>
															{h.durationMs != null ? `${h.durationMs}ms` : '—'}
														</div>
													</div>
												))}
											</div>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
