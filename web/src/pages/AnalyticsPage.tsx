import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';
import { PageError, PageLoading } from '@/components/common/PageState';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	type TooltipProps,
	XAxis,
	YAxis,
} from 'recharts';
import {
	getAnalyticsMostFailingTests,
	getAnalyticsSlowestTests,
	getAnalyticsTimeseries,
	type AnalyticsMostFailingTestItem,
	type AnalyticsSlowTestItem,
	type AnalyticsTimeseriesItem,
} from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { usePageTitle } from '@/lib/usePageTitle';

function ms(n: number | null | undefined) {
	if (n == null) return '—';
	return `${Math.round(n)}ms`;
}

const compactNumber = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1,
});

function formatCount(value: number | string | null | undefined) {
	const n = typeof value === 'number' ? value : Number(value ?? 0);
	return Number.isFinite(n) ? compactNumber.format(n) : '0';
}

function formatDuration(value: number | string | null | undefined) {
	const n = typeof value === 'number' ? value : Number(value ?? 0);
	if (!Number.isFinite(n)) return '—';
	if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
	return `${Math.round(n)}ms`;
}

function truncateLabel(label: string) {
	if (label.length <= 18) return label;
	return `${label.slice(0, 16)}…`;
}

function ChartTooltip({
	active,
	payload,
	label,
}: TooltipProps<number, string>) {
	if (!active || !payload?.length) return null;

	return (
		<div className='rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md'>
			<div className='mb-1 text-[11px] text-muted-foreground'>{label}</div>
			<div className='space-y-1'>
				{payload.map((entry) => (
					<div
						key={String(entry.dataKey)}
						className='flex items-center justify-between gap-4'>
						<div className='flex items-center gap-2'>
							<span
								className='h-2 w-2 rounded-full'
								style={{ background: entry.color }}
							/>
							<span>{entry.name ?? entry.dataKey}</span>
						</div>
						<span className='font-mono'>
							{entry.dataKey === 'avg' || entry.dataKey === 'max'
								? formatDuration(entry.value)
								: formatCount(entry.value)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

export function AnalyticsPage() {
	const { projectId } = useParams();
	usePageTitle('Analytics');

	const { apiKey } = useAuth();
	const canLoad = Boolean(apiKey);

	const [days, setDays] = useState<number>(7);
	const limit = 20;
	const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
	const [timeseriesView, setTimeseriesView] = useState<'bar' | 'area'>('bar');

	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lastStatus, setLastStatus] = useState<number | null>(null);

	const [timeseries, setTimeseries] = useState<AnalyticsTimeseriesItem[]>([]);
	const [slowest, setSlowest] = useState<AnalyticsSlowTestItem[]>([]);
	const [mostFailing, setMostFailing] = useState<
		AnalyticsMostFailingTestItem[]
	>([]);

	const projectSlug = projectId ?? '';

	const hasNoData = useMemo(() => {
		if (!timeseries.length) return true;
		const totals = timeseries.reduce((acc, d) => acc + (d.totalCount ?? 0), 0);
		return totals === 0;
	}, [timeseries]);

	const timeseriesChartData = useMemo(
		() =>
			timeseries.map((d) => ({
				day: d.day,
				passed: d.passedCount ?? 0,
				failed: d.failedCount ?? 0,
				error: d.errorCount ?? 0,
				skipped: d.skippedCount ?? 0,
				total: d.totalCount ?? 0,
			})),
		[timeseries],
	);

	const slowestChartData = useMemo(
		() =>
			slowest.map((t) => ({
				name: t.name,
				suite: t.suiteName ?? '—',
				avg: t.avgDurationMs ?? 0,
				max: t.maxDurationMs ?? 0,
			})),
		[slowest],
	);

	const mostFailingChartData = useMemo(
		() =>
			mostFailing.map((t) => ({
				name: t.name,
				suite: t.suiteName ?? '—',
				failed: t.failedCount ?? 0,
				error: t.errorCount ?? 0,
			})),
		[mostFailing],
	);

	const load = useCallback(
		async (opts?: { silent?: boolean }) => {
			if (!canLoad || !projectSlug) return;
			setError(null);
			setLastStatus(null);
			if (opts?.silent) setRefreshing(true);
			else setLoading(true);

			try {
				const [ts, slow, failing] = await Promise.all([
					getAnalyticsTimeseries(projectSlug, { days }),
					getAnalyticsSlowestTests(projectSlug, { days, limit }),
					getAnalyticsMostFailingTests(projectSlug, { days, limit }),
				]);
				setTimeseries(ts.items ?? []);
				setSlowest(slow.items ?? []);
				setMostFailing(failing.items ?? []);
			} catch (e: any) {
				setLastStatus(e?.status ?? null);
				setError(e?.message ?? 'Failed to load analytics');
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[canLoad, days, limit, projectSlug],
	);

	useEffect(() => {
		void load();
	}, [load]);

	if (!projectId) {
		return <PageError title='Missing project' message='No project selected.' />;
	}

	if (!canLoad || lastStatus === 401) {
		return (
			<div className='p-6'>
				<h1 className='text-2xl font-semibold'>Analytics</h1>
				<p className='mt-2 text-sm text-muted-foreground'>
					Project: <span className='font-mono'>{projectId}</span>
				</p>
				<div className='mt-6'>
					<AuthRequiredCallout />
				</div>
			</div>
		);
	}

	if (loading) {
		return <PageLoading title='Loading analytics' />;
	}

	if (error) {
		return (
			<PageError
				title='Failed to load analytics'
				message={error}
				actionLabel='Retry'
				onAction={() => load()}
			/>
		);
	}

	return (
		<div className='p-6'>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
				<div>
					<h1 className='text-2xl font-semibold'>Analytics</h1>
					<p className='mt-2 text-sm text-muted-foreground'>
						Last {days} day{days === 1 ? '' : 's'} for{' '}
						<span className='font-mono'>{projectId}</span>
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<Select
						value={String(days)}
						onValueChange={(v) => setDays(Number(v))}>
						<SelectTrigger className='w-[160px]'>
							<SelectValue placeholder='Window' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='7'>Last 7 days</SelectItem>
							<SelectItem value='14'>Last 14 days</SelectItem>
							<SelectItem value='30'>Last 30 days</SelectItem>
							<SelectItem value='60'>Last 60 days</SelectItem>
							<SelectItem value='90'>Last 90 days</SelectItem>
						</SelectContent>
					</Select>
					<div className='flex items-center gap-1 rounded-md border bg-card p-1'>
						<Button
							size='sm'
							className={cn(
								'h-8',
								viewMode === 'table' ? '' : 'bg-transparent',
							)}
							variant={viewMode === 'table' ? 'default' : 'outline'}
							onClick={() => setViewMode('table')}>
							Tabular
						</Button>
						<Button
							size='sm'
							className={cn(
								'h-8',
								viewMode === 'chart' ? '' : 'bg-transparent',
							)}
							variant={viewMode === 'chart' ? 'default' : 'outline'}
							onClick={() => setViewMode('chart')}>
							Charts
						</Button>
					</div>
					<Button
						variant='secondary'
						disabled={refreshing}
						onClick={() => load({ silent: true })}>
						{refreshing ? 'Refreshing…' : 'Refresh'}
					</Button>
				</div>
			</div>

			<Separator className='my-6' />

			{hasNoData && (
				<div className='rounded-lg border bg-card p-4 text-sm text-muted-foreground'>
					No run results in the selected window yet.
				</div>
			)}

			<div className='grid gap-6'>
				<section className='rounded-lg border bg-card p-4'>
					<div className='flex items-center justify-between'>
						<div>
							<h2 className='text-base font-semibold'>Failures over time</h2>
							<p className='text-xs text-muted-foreground'>
								Daily totals by status
							</p>
						</div>
						{viewMode === 'chart' ? (
							<div className='flex items-center gap-1 rounded-md border bg-card p-1'>
								<Button
									size='sm'
									className={cn(
										'h-7 px-2',
										timeseriesView === 'bar' ? '' : 'bg-transparent',
									)}
									variant={timeseriesView === 'bar' ? 'default' : 'outline'}
									onClick={() => setTimeseriesView('bar')}>
									Bars
								</Button>
								<Button
									size='sm'
									className={cn(
										'h-7 px-2',
										timeseriesView === 'area' ? '' : 'bg-transparent',
									)}
									variant={timeseriesView === 'area' ? 'default' : 'outline'}
									onClick={() => setTimeseriesView('area')}>
									Stacked area
								</Button>
							</div>
						) : null}
					</div>
					{viewMode === 'table' ? (
						<div className='mt-3 overflow-x-auto'>
							<div className='min-w-[640px] divide-y rounded-md border'>
								<div className='grid grid-cols-6 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground'>
									<div>Day</div>
									<div className='text-right'>Passed</div>
									<div className='text-right'>Failed</div>
									<div className='text-right'>Error</div>
									<div className='text-right'>Skipped</div>
									<div className='text-right'>Total</div>
								</div>
								{timeseries.length ? (
									timeseries.map((d) => (
										<div
											key={d.day}
											className='grid grid-cols-6 gap-2 px-3 py-2 text-sm'>
											<div className='font-mono text-xs'>{d.day}</div>
											<div className='text-right'>{d.passedCount}</div>
											<div className='text-right'>{d.failedCount}</div>
											<div className='text-right'>{d.errorCount}</div>
											<div className='text-right'>{d.skippedCount}</div>
											<div className='text-right font-medium'>
												{d.totalCount}
											</div>
										</div>
									))
								) : (
									<div className='px-3 py-3 text-sm text-muted-foreground'>
										No data.
									</div>
								)}
							</div>
						</div>
					) : (
						<div className='mt-4 h-64 rounded-md border bg-muted/10 p-3'>
							{timeseries.length ? (
								<ResponsiveContainer width='100%' height='100%'>
									{timeseriesView === 'bar' ? (
										<BarChart
											data={timeseriesChartData}
											margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
											<CartesianGrid
												strokeDasharray='3 3'
												stroke='var(--border)'
												strokeOpacity={0.4}
											/>
											<XAxis
												dataKey='day'
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
												minTickGap={16}
											/>
											<YAxis
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
												tickFormatter={(v) => formatCount(v)}
											/>
											<Tooltip content={<ChartTooltip />} />
											<Legend
												verticalAlign='top'
												align='right'
												iconType='circle'
												iconSize={8}
												wrapperStyle={{ paddingBottom: 8 }}
											/>
											<Bar
												dataKey='passed'
												stackId='a'
												fill='var(--chart-2-40)'
												stroke='var(--chart-2-65)'
												strokeWidth={1}
												radius={[3, 3, 0, 0]}
											/>
											<Bar
												dataKey='failed'
												stackId='a'
												fill='var(--chart-5-40)'
												stroke='var(--chart-5-65)'
												strokeWidth={1}
											/>
											<Bar
												dataKey='error'
												stackId='a'
												fill='var(--chart-4-40)'
												stroke='var(--chart-4-65)'
												strokeWidth={1}
											/>
											<Bar
												dataKey='skipped'
												stackId='a'
												fill='var(--chart-3-40)'
												stroke='var(--chart-3-65)'
												strokeWidth={1}
											/>
										</BarChart>
									) : (
										<AreaChart
											data={timeseriesChartData}
											margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
											<CartesianGrid
												strokeDasharray='3 3'
												stroke='var(--border)'
												strokeOpacity={0.4}
											/>
											<XAxis
												dataKey='day'
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
												minTickGap={16}
											/>
											<YAxis
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
												tickFormatter={(v) => formatCount(v)}
											/>
											<Tooltip content={<ChartTooltip />} />
											<Legend
												verticalAlign='top'
												align='right'
												iconType='circle'
												iconSize={8}
												wrapperStyle={{ paddingBottom: 8 }}
											/>
											<Area
												dataKey='passed'
												stackId='a'
												fill='var(--chart-2-40)'
												stroke='var(--chart-2-65)'
												strokeWidth={1}
												type='monotone'
											/>
											<Area
												dataKey='failed'
												stackId='a'
												fill='var(--chart-5-40)'
												stroke='var(--chart-5-65)'
												strokeWidth={1}
												type='monotone'
											/>
											<Area
												dataKey='error'
												stackId='a'
												fill='var(--chart-4-40)'
												stroke='var(--chart-4-65)'
												strokeWidth={1}
												type='monotone'
											/>
											<Area
												dataKey='skipped'
												stackId='a'
												fill='var(--chart-3-40)'
												stroke='var(--chart-3-65)'
												strokeWidth={1}
												type='monotone'
											/>
										</AreaChart>
									)}
								</ResponsiveContainer>
							) : (
								<div className='flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground'>
									No data
								</div>
							)}
						</div>
					)}
				</section>

				<section className='grid gap-6 lg:grid-cols-2'>
					<div className='rounded-lg border bg-card p-4'>
						<h2 className='text-base font-semibold'>Slowest tests</h2>
						<p className='mt-1 text-xs text-muted-foreground'>
							Top {limit} by avg duration
						</p>
						{viewMode === 'table' ? (
							<div className='mt-3 overflow-x-auto'>
								<div className='min-w-[520px] divide-y rounded-md border'>
									<div className='grid grid-cols-6 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground'>
										<div className='col-span-2'>Test</div>
										<div className='col-span-2'>Suite</div>
										<div className='text-right'>Avg</div>
										<div className='text-right'>Max</div>
									</div>
									{slowest.length ? (
										slowest.map((t) => (
											<div
												key={t.testCaseId}
												className='grid grid-cols-6 gap-2 px-3 py-2 text-sm'>
												<div className='col-span-2 truncate font-mono text-xs'>
													{t.name}
												</div>
												<div className='col-span-2 truncate font-mono text-xs'>
													{t.suiteName ?? '—'}
												</div>
												<div className='text-right'>{ms(t.avgDurationMs)}</div>
												<div className='text-right'>{ms(t.maxDurationMs)}</div>
											</div>
										))
									) : (
										<div className='px-3 py-3 text-sm text-muted-foreground'>
											No slow tests yet.
										</div>
									)}
								</div>
							</div>
						) : (
							<div className='mt-4 h-64 rounded-md border bg-muted/10 p-3'>
								{slowestChartData.length ? (
									<ResponsiveContainer width='100%' height='100%'>
										<BarChart
											data={slowestChartData}
											layout='vertical'
											margin={{ top: 8, right: 16, left: 16, bottom: 4 }}>
											<CartesianGrid
												strokeDasharray='3 3'
												stroke='var(--border)'
												strokeOpacity={0.4}
											/>
											<XAxis
												type='number'
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
												tickFormatter={(v) => formatDuration(v)}
											/>
											<YAxis
												dataKey='name'
												type='category'
												width={140}
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												tickFormatter={(v) => truncateLabel(String(v))}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
											/>
											<Tooltip content={<ChartTooltip />} />
											<Legend
												verticalAlign='top'
												align='right'
												iconType='circle'
												iconSize={8}
												wrapperStyle={{ paddingBottom: 8 }}
											/>
											<Bar
												dataKey='avg'
												fill='var(--chart-1-40)'
												stroke='var(--chart-1-65)'
												strokeWidth={1}
												name='Avg (ms)'
												radius={[0, 4, 4, 0]}
											/>
											<Bar
												dataKey='max'
												fill='var(--chart-3-40)'
												stroke='var(--chart-3-65)'
												strokeWidth={1}
												name='Max (ms)'
											/>
										</BarChart>
									</ResponsiveContainer>
								) : (
									<div className='flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground'>
										No slow tests yet
									</div>
								)}
							</div>
						)}
					</div>

					<div className='rounded-lg border bg-card p-4'>
						<h2 className='text-base font-semibold'>Most failing tests</h2>
						<p className='mt-1 text-xs text-muted-foreground'>
							Top {limit} by fail/error count
						</p>
						{viewMode === 'table' ? (
							<div className='mt-3 overflow-x-auto'>
								<div className='min-w-[520px] divide-y rounded-md border'>
									<div className='grid grid-cols-6 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground'>
										<div className='col-span-2'>Test</div>
										<div className='col-span-2'>Suite</div>
										<div className='text-right'>Fail</div>
										<div className='text-right'>Err</div>
									</div>
									{mostFailing.length ? (
										mostFailing.map((t) => (
											<div
												key={t.testCaseId}
												className='grid grid-cols-6 gap-2 px-3 py-2 text-sm'>
												<div className='col-span-2 truncate font-mono text-xs'>
													{t.name}
												</div>
												<div className='col-span-2 truncate font-mono text-xs'>
													{t.suiteName ?? '—'}
												</div>
												<div className='text-right'>{t.failedCount}</div>
												<div className='text-right'>{t.errorCount}</div>
											</div>
										))
									) : (
										<div className='px-3 py-3 text-sm text-muted-foreground'>
											No failing tests yet.
										</div>
									)}
								</div>
							</div>
						) : (
							<div className='mt-4 h-64 rounded-md border bg-muted/10 p-3'>
								{mostFailingChartData.length ? (
									<ResponsiveContainer width='100%' height='100%'>
										<BarChart
											data={mostFailingChartData}
											layout='vertical'
											margin={{ top: 8, right: 16, left: 16, bottom: 4 }}>
											<CartesianGrid
												strokeDasharray='3 3'
												stroke='var(--border)'
												strokeOpacity={0.4}
											/>
											<XAxis
												type='number'
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
												tickFormatter={(v) => formatCount(v)}
											/>
											<YAxis
												dataKey='name'
												type='category'
												width={140}
												tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
												tickFormatter={(v) => truncateLabel(String(v))}
												axisLine={{ stroke: 'var(--border)' }}
												tickLine={{ stroke: 'var(--border)' }}
											/>
											<Tooltip content={<ChartTooltip />} />
											<Legend
												verticalAlign='top'
												align='right'
												iconType='circle'
												iconSize={8}
												wrapperStyle={{ paddingBottom: 8 }}
											/>
											<Bar
												dataKey='failed'
												stackId='a'
												fill='var(--chart-5-40)'
												stroke='var(--chart-5-65)'
												strokeWidth={1}
												name='Failed'
												radius={[0, 4, 4, 0]}
											/>
											<Bar
												dataKey='error'
												stackId='a'
												fill='var(--chart-4-40)'
												stroke='var(--chart-4-65)'
												strokeWidth={1}
												name='Error'
											/>
										</BarChart>
									</ResponsiveContainer>
								) : (
									<div className='flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground'>
										No failing tests yet
									</div>
								)}
							</div>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
