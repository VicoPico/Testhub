import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';
import { PageError, PageLoading } from '@/components/common/PageState';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@/components/ui/chart';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
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

function normalizeValue(value: unknown): number | string | null | undefined {
	if (Array.isArray(value)) return value[0];
	return value as number | string | null | undefined;
}

function truncateLabel(label: string) {
	if (label.length <= 18) return label;
	return `${label.slice(0, 16)}…`;
}

const chartConfig: ChartConfig = {
	passed: {
		label: 'Passed',
		theme: { light: 'var(--chart-2-40)', dark: 'var(--chart-2-40)' },
	},
	failed: {
		label: 'Failed',
		theme: { light: 'var(--chart-5-40)', dark: 'var(--chart-5-40)' },
	},
	error: {
		label: 'Error',
		theme: { light: 'var(--chart-4-40)', dark: 'var(--chart-4-40)' },
	},
	skipped: {
		label: 'Skipped',
		theme: { light: 'var(--chart-3-40)', dark: 'var(--chart-3-40)' },
	},
	avg: {
		label: 'Avg (ms)',
		theme: { light: 'var(--chart-1-40)', dark: 'var(--chart-1-40)' },
	},
	max: {
		label: 'Max (ms)',
		theme: { light: 'var(--chart-3-40)', dark: 'var(--chart-3-40)' },
	},
};

export function AnalyticsPage() {
	const { projectId } = useParams();
	usePageTitle('Analytics');

	const { apiKey } = useAuth();
	const canLoad = Boolean(apiKey);

	const [days, setDays] = useState<number>(7);
	const limit = 5;
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
				dayTs: new Date(d.day).getTime(),
				passed: d.passedCount ?? 0,
				failed: d.failedCount ?? 0,
				error: d.errorCount ?? 0,
				skipped: d.skippedCount ?? 0,
				total: d.totalCount ?? 0,
			})),
		[timeseries],
	);

	const totals = useMemo(() => {
		return timeseriesChartData.reduce(
			(acc, d) => {
				acc.passed += d.passed ?? 0;
				acc.failed += d.failed ?? 0;
				acc.error += d.error ?? 0;
				acc.skipped += d.skipped ?? 0;
				return acc;
			},
			{ passed: 0, failed: 0, error: 0, skipped: 0 },
		);
	}, [timeseriesChartData]);

	const pieData = useMemo(
		() =>
			[
				{ key: 'passed', name: 'Passed', value: totals.passed },
				{ key: 'failed', name: 'Failed', value: totals.failed },
				{ key: 'error', name: 'Error', value: totals.error },
				{ key: 'skipped', name: 'Skipped', value: totals.skipped },
			].filter((d) => d.value > 0),
		[totals],
	);

	const timeDomain = useMemo(() => {
		if (!timeseriesChartData.length) return undefined;
		const nonZero = timeseriesChartData.filter((d) => d.total > 0);
		const source = nonZero.length ? nonZero : timeseriesChartData;
		let min = Number.POSITIVE_INFINITY;
		let max = Number.NEGATIVE_INFINITY;
		for (const d of source) {
			if (d.dayTs < min) min = d.dayTs;
			if (d.dayTs > max) max = d.dayTs;
		}
		return [min, max] as [number, number];
	}, [timeseriesChartData]);

	const formatDay = useCallback((value: number | string) => {
		const ts = typeof value === 'number' ? value : Number(value);
		if (!Number.isFinite(ts)) return '';
		return new Date(ts).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
		});
	}, []);

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
			} catch (e: unknown) {
				const err = e as { status?: number; message?: string } | null;
				setLastStatus(err?.status ?? null);
				setError(err?.message ?? 'Failed to load analytics');
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
				onRetry={() => load()}
			/>
		);
	}

	return (
		<div className='p-4 space-y-4'>
			<Card className='bg-muted text-foreground'>
				<CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
					<div className='space-y-1.5'>
						<CardTitle>Analytics</CardTitle>
						<CardDescription>
							Last {days} day{days === 1 ? '' : 's'} for{' '}
							<span className='font-mono'>{projectId}</span>
						</CardDescription>
					</div>
					<div className='flex flex-wrap items-center gap-2 sm:justify-end'>
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
						<div className='flex items-center gap-2 text-xs text-muted-foreground'>
							<Switch
								size='sm'
								checked={viewMode === 'chart'}
								onCheckedChange={(checked) =>
									setViewMode(checked ? 'chart' : 'table')
								}
							/>
							<span className='inline-flex min-w-[72px] justify-start'>
								{viewMode === 'chart' ? 'Charts' : 'Tabular'}
							</span>
						</div>
						<Button
							variant='secondary'
							disabled={refreshing}
							onClick={() => load({ silent: true })}>
							{refreshing ? 'Refreshing…' : 'Refresh'}
						</Button>
					</div>
				</CardHeader>
			</Card>

			{hasNoData && (
				<Card className='bg-muted text-foreground'>
					<CardContent className='pt-4 text-sm text-muted-foreground'>
						No run results in the selected window yet.
					</CardContent>
				</Card>
			)}

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card className='bg-muted text-foreground'>
					<CardHeader className='flex flex-row items-start justify-between gap-4 space-y-0'>
						<div>
							<CardTitle>Failures over time</CardTitle>
							<CardDescription>Daily totals by status</CardDescription>
						</div>
						{viewMode === 'chart' ? (
							<div className='flex items-center gap-2 text-xs text-muted-foreground'>
								<Switch
									size='sm'
									checked={timeseriesView === 'area'}
									onCheckedChange={(checked) =>
										setTimeseriesView(checked ? 'area' : 'bar')
									}
								/>
								<span className='inline-flex min-w-[96px] justify-start'>
									{timeseriesView === 'area' ? 'Stacked area' : 'Bars'}
								</span>
							</div>
						) : null}
					</CardHeader>
					<CardContent>
						{viewMode === 'table' ? (
							<div className='overflow-x-auto'>
								<div className='max-h-[240px] min-w-[640px] overflow-y-auto divide-y rounded-md border dark:bg-[rgb(20,25,28)]'>
									<div className='grid grid-cols-6 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-[rgb(20,25,28)]'>
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
							<div className='h-64 rounded-md border bg-background p-3 dark:bg-[rgb(20,25,28)]'>
								{timeseries.length ? (
									<ChartContainer
										className='h-full w-full'
										config={chartConfig}>
										{timeseriesView === 'bar' ? (
											<BarChart
												data={timeseriesChartData}
												margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
												<CartesianGrid
													vertical={false}
													strokeDasharray='3 3'
													stroke='var(--border)'
													strokeOpacity={0.4}
												/>
												<XAxis
													dataKey='dayTs'
													type='number'
													domain={timeDomain}
													tick={{
														fontSize: 10,
														fill: 'var(--muted-foreground)',
													}}
													tickLine={false}
													axisLine={false}
													tickMargin={8}
													minTickGap={16}
													tickFormatter={formatDay}
												/>
												<YAxis
													tick={{
														fontSize: 10,
														fill: 'var(--muted-foreground)',
													}}
													tickLine={false}
													axisLine={false}
													tickMargin={8}
													tickFormatter={(v) => formatCount(v)}
												/>
												<ChartTooltip
													content={
														<ChartTooltipContent
															labelFormatter={(label) =>
																formatDay(label as number | string)
															}
															formatter={(value, name) => {
																const normalized = normalizeValue(value);
																return name === 'avg' || name === 'max'
																	? formatDuration(normalized)
																	: formatCount(normalized);
															}}
														/>
													}
													cursor={false}
												/>
												<ChartLegend content={<ChartLegendContent />} />
												<Bar
													dataKey='passed'
													stackId='a'
													fill='var(--color-passed)'
													stroke='var(--chart-2-65)'
													strokeWidth={1}
													radius={[3, 3, 0, 0]}
												/>
												<Bar
													dataKey='failed'
													stackId='a'
													fill='var(--color-failed)'
													stroke='var(--chart-5-65)'
													strokeWidth={1}
												/>
												<Bar
													dataKey='error'
													stackId='a'
													fill='var(--color-error)'
													stroke='var(--chart-4-65)'
													strokeWidth={1}
												/>
												<Bar
													dataKey='skipped'
													stackId='a'
													fill='var(--color-skipped)'
													stroke='var(--chart-3-65)'
													strokeWidth={1}
												/>
											</BarChart>
										) : (
											<AreaChart
												data={timeseriesChartData}
												margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
												<CartesianGrid
													vertical={false}
													strokeDasharray='3 3'
													stroke='var(--border)'
													strokeOpacity={0.4}
												/>
												<XAxis
													dataKey='dayTs'
													type='number'
													domain={timeDomain}
													tick={{
														fontSize: 10,
														fill: 'var(--muted-foreground)',
													}}
													tickLine={false}
													axisLine={false}
													minTickGap={24}
													tickMargin={8}
													tickFormatter={formatDay}
												/>
												<YAxis
													tick={{
														fontSize: 10,
														fill: 'var(--muted-foreground)',
													}}
													tickLine={false}
													axisLine={false}
													tickMargin={8}
													tickFormatter={(v) => formatCount(v)}
												/>
												<ChartTooltip
													content={
														<ChartTooltipContent
															labelFormatter={(label) =>
																formatDay(label as number | string)
															}
															formatter={(value, name) => {
																const normalized = normalizeValue(value);
																return name === 'avg' || name === 'max'
																	? formatDuration(normalized)
																	: formatCount(normalized);
															}}
														/>
													}
													cursor={false}
												/>
												<ChartLegend content={<ChartLegendContent />} />
												<defs>
													<linearGradient
														id='fillPassed'
														x1='0'
														y1='0'
														x2='0'
														y2='1'>
														<stop
															offset='5%'
															stopColor='var(--color-passed)'
															stopOpacity={0.5}
														/>
														<stop
															offset='95%'
															stopColor='var(--color-passed)'
															stopOpacity={0.05}
														/>
													</linearGradient>
													<linearGradient
														id='fillFailed'
														x1='0'
														y1='0'
														x2='0'
														y2='1'>
														<stop
															offset='5%'
															stopColor='var(--color-failed)'
															stopOpacity={0.5}
														/>
														<stop
															offset='95%'
															stopColor='var(--color-failed)'
															stopOpacity={0.05}
														/>
													</linearGradient>
													<linearGradient
														id='fillError'
														x1='0'
														y1='0'
														x2='0'
														y2='1'>
														<stop
															offset='5%'
															stopColor='var(--color-error)'
															stopOpacity={0.5}
														/>
														<stop
															offset='95%'
															stopColor='var(--color-error)'
															stopOpacity={0.05}
														/>
													</linearGradient>
													<linearGradient
														id='fillSkipped'
														x1='0'
														y1='0'
														x2='0'
														y2='1'>
														<stop
															offset='5%'
															stopColor='var(--color-skipped)'
															stopOpacity={0.5}
														/>
														<stop
															offset='95%'
															stopColor='var(--color-skipped)'
															stopOpacity={0.05}
														/>
													</linearGradient>
												</defs>
												<Area
													dataKey='passed'
													stackId='a'
													fill='url(#fillPassed)'
													stroke='var(--chart-2-65)'
													strokeWidth={1}
													type='monotone'
												/>
												<Area
													dataKey='failed'
													stackId='a'
													fill='url(#fillFailed)'
													stroke='var(--chart-5-65)'
													strokeWidth={1}
													type='monotone'
												/>
												<Area
													dataKey='error'
													stackId='a'
													fill='url(#fillError)'
													stroke='var(--chart-4-65)'
													strokeWidth={1}
													type='monotone'
												/>
												<Area
													dataKey='skipped'
													stackId='a'
													fill='url(#fillSkipped)'
													stroke='var(--chart-3-65)'
													strokeWidth={1}
													type='monotone'
												/>
											</AreaChart>
										)}
									</ChartContainer>
								) : (
									<div className='flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground'>
										No data
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className='bg-muted text-foreground'>
					<CardHeader>
						<CardTitle>Failures breakdown</CardTitle>
						<CardDescription>Totals by status</CardDescription>
					</CardHeader>
					<CardContent>
						{viewMode === 'table' ? (
							<div className='overflow-x-auto'>
								<div className='max-h-[240px] min-w-[360px] overflow-y-auto divide-y rounded-md border dark:bg-[rgb(20,25,28)]'>
									<div className='grid grid-cols-2 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-[rgb(20,25,28)]'>
										<div>Status</div>
										<div className='text-right'>Total</div>
									</div>
									{pieData.length ? (
										pieData.map((item) => (
											<div
												key={item.key}
												className='grid grid-cols-2 gap-2 px-3 py-2 text-sm'>
												<div className='font-mono text-xs'>{item.name}</div>
												<div className='text-right font-medium'>
													{formatCount(item.value)}
												</div>
											</div>
										))
									) : (
										<div className='px-3 py-3 text-sm text-muted-foreground'>
											No data
										</div>
									)}
								</div>
							</div>
						) : (
							<div className='h-64 rounded-md bg-background p-3 dark:bg-[rgb(20,25,28)]'>
								{pieData.length ? (
									<ChartContainer
										className='h-full w-full'
										config={chartConfig}>
										<PieChart>
											<ChartTooltip content={<ChartTooltipContent />} />
											<Pie
												data={pieData}
												dataKey='value'
												nameKey='name'
												innerRadius={55}
												outerRadius={90}
												paddingAngle={4}
												stroke='none'>
												{pieData.map((entry) => (
													<Cell
														key={entry.key}
														fill={`var(--color-${entry.key})`}
													/>
												))}
											</Pie>
											<ChartLegend content={<ChartLegendContent />} />
										</PieChart>
									</ChartContainer>
								) : (
									<div className='flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground'>
										No data
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card className='bg-muted text-foreground'>
					<CardHeader>
						<CardTitle>Slowest tests</CardTitle>
						<CardDescription>Top {limit} by avg duration</CardDescription>
					</CardHeader>
					<CardContent>
						{viewMode === 'table' ? (
							<div className='overflow-x-auto'>
								<div className='max-h-[240px] min-w-[520px] overflow-y-auto divide-y rounded-md border dark:bg-[rgb(20,25,28)]'>
									<div className='grid grid-cols-6 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-[rgb(20,25,28)]'>
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
							<div className='h-64 rounded-md border border-border bg-background p-3 dark:bg-[rgb(20,25,28)]'>
								{slowestChartData.length ? (
									<ChartContainer
										className='h-full w-full'
										config={chartConfig}>
										<BarChart
											data={slowestChartData}
											layout='vertical'
											margin={{ top: 8, right: 16, left: 16, bottom: 4 }}>
											<CartesianGrid
												vertical={false}
												strokeDasharray='3 3'
												stroke='var(--border)'
												strokeOpacity={0.4}
											/>
											<XAxis
												type='number'
												tick={{
													fontSize: 10,
													fill: 'var(--muted-foreground)',
												}}
												tickLine={false}
												axisLine={false}
												tickMargin={8}
												tickFormatter={(v) => formatDuration(v)}
											/>
											<YAxis
												dataKey='name'
												type='category'
												width={140}
												tick={{
													fontSize: 10,
													fill: 'var(--muted-foreground)',
												}}
												tickFormatter={(v) => truncateLabel(String(v))}
												axisLine={false}
												tickLine={false}
												tickMargin={8}
											/>
											<ChartTooltip
												content={
													<ChartTooltipContent
														labelFormatter={(label) =>
															formatDay(label as number | string)
														}
														formatter={(value, name) => {
															const normalized = normalizeValue(value);
															return name === 'avg' || name === 'max'
																? formatDuration(normalized)
																: formatCount(normalized);
														}}
													/>
												}
												cursor={false}
											/>
											<ChartLegend content={<ChartLegendContent />} />
											<Bar
												dataKey='avg'
												fill='var(--color-avg)'
												stroke='var(--chart-1-65)'
												strokeWidth={1}
												name='Avg (ms)'
												radius={[0, 4, 4, 0]}
											/>
											<Bar
												dataKey='max'
												fill='var(--color-max)'
												stroke='var(--chart-3-65)'
												strokeWidth={1}
												name='Max (ms)'
											/>
										</BarChart>
									</ChartContainer>
								) : (
									<div className='flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground'>
										No slow tests yet
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className='bg-muted text-foreground'>
					<CardHeader>
						<CardTitle>Most failing tests</CardTitle>
						<CardDescription>Top {limit} by fail/error count</CardDescription>
					</CardHeader>
					<CardContent>
						{viewMode === 'table' ? (
							<div className='overflow-x-auto'>
								<div className='max-h-[240px] min-w-[520px] overflow-y-auto divide-y rounded-md border dark:bg-[rgb(20,25,28)]'>
									<div className='grid grid-cols-6 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-[rgb(20,25,28)]'>
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
							<div className='h-64 rounded-md border bg-background p-3 dark:bg-[rgb(20,25,28)]'>
								{mostFailingChartData.length ? (
									<ChartContainer
										className='h-full w-full'
										config={chartConfig}>
										<BarChart
											data={mostFailingChartData}
											layout='vertical'
											margin={{ top: 8, right: 16, left: 16, bottom: 4 }}>
											<CartesianGrid
												vertical={false}
												strokeDasharray='3 3'
												stroke='var(--border)'
												strokeOpacity={0.4}
											/>
											<XAxis
												type='number'
												tick={{
													fontSize: 10,
													fill: 'var(--muted-foreground)',
												}}
												tickLine={false}
												axisLine={false}
												tickMargin={8}
												tickFormatter={(v) => formatCount(v)}
											/>
											<YAxis
												dataKey='name'
												type='category'
												width={140}
												tick={{
													fontSize: 10,
													fill: 'var(--muted-foreground)',
												}}
												tickFormatter={(v) => truncateLabel(String(v))}
												axisLine={false}
												tickLine={false}
												tickMargin={8}
											/>
											<ChartTooltip
												content={
													<ChartTooltipContent
														formatter={(value) =>
															formatCount(normalizeValue(value))
														}
													/>
												}
												cursor={false}
											/>
											<ChartLegend content={<ChartLegendContent />} />
											<Bar
												dataKey='failed'
												stackId='a'
												fill='var(--color-failed)'
												stroke='var(--chart-5-65)'
												strokeWidth={1}
												name='Failed'
												radius={[0, 4, 4, 0]}
											/>
											<Bar
												dataKey='error'
												stackId='a'
												fill='var(--color-error)'
												stroke='var(--chart-4-65)'
												strokeWidth={1}
												name='Error'
											/>
										</BarChart>
									</ChartContainer>
								) : (
									<div className='flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground'>
										No failing tests yet
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
