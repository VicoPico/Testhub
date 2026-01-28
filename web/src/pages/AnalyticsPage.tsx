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
import { Switch } from '@/components/ui/switch';
import { AnalyticsMostFailingCard } from '@/components/analytics/AnalyticsMostFailingCard';
import { AnalyticsOverviewCard } from '@/components/analytics/AnalyticsOverviewCard';
import { AnalyticsSlowestCard } from '@/components/analytics/AnalyticsSlowestCard';
import { AnalyticsTimeseriesCard } from '@/components/analytics/AnalyticsTimeseriesCard';
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

export function AnalyticsPage() {
	const { projectId } = useParams();
	usePageTitle('Analytics');

	const { apiKey, hasApiKey } = useAuth();
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

	const totalTests =
		totals.passed + totals.failed + totals.error + totals.skipped;

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

	const showAuthCallout = !hasApiKey || lastStatus === 401;

	if (showAuthCallout) {
		return (
			<div className='space-y-6'>
				<div>
					<h1 className='text-xl font-semibold'>Analytics</h1>
					<p className='text-sm text-muted-foreground'>
						Project: <span className='font-mono'>{projectId}</span>
					</p>
				</div>
				<AuthRequiredCallout />
			</div>
		);
	}

	return (
		<div className='space-y-6'>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
				<div>
					<h1 className='text-xl font-semibold'>Analytics</h1>
					<p className='text-sm text-muted-foreground'>
						Project: <span className='font-mono'>{projectId}</span>
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-3'>
					<Select
						value={String(days)}
						onValueChange={(value) => setDays(Number(value))}>
						<SelectTrigger className='h-8 w-[120px]'>
							<SelectValue placeholder='Days' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='7'>Last 7 days</SelectItem>
							<SelectItem value='14'>Last 14 days</SelectItem>
							<SelectItem value='30'>Last 30 days</SelectItem>
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
						<span className='inline-flex min-w-[80px] justify-start'>
							{viewMode === 'chart' ? 'Charts' : 'Table'}
						</span>
					</div>
					<Button
						variant='outline'
						size='sm'
						disabled={loading || refreshing}
						onClick={() => void load({ silent: true })}>
						{refreshing ? 'Refreshing...' : 'Refresh'}
					</Button>
				</div>
			</div>

			{error ? (
				<PageError
					title='Analytics'
					message={error}
					onRetry={() => void load()}
				/>
			) : loading ? (
				<PageLoading title='Analytics' />
			) : hasNoData ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					No data for this time range yet.
				</div>
			) : (
				<div className='space-y-6'>
					<div className='grid gap-6 lg:grid-cols-2'>
						<AnalyticsTimeseriesCard
							viewMode={viewMode}
							timeseriesView={timeseriesView}
							onTimeseriesViewChange={setTimeseriesView}
							timeseries={timeseries}
							timeseriesChartData={timeseriesChartData}
							timeDomain={timeDomain}
						/>
						<AnalyticsOverviewCard
							viewMode={viewMode}
							pieData={pieData}
							totalTests={totalTests}
						/>
					</div>

					<div className='grid gap-6 lg:grid-cols-2'>
						<AnalyticsSlowestCard
							viewMode={viewMode}
							limit={limit}
							slowest={slowest}
							slowestChartData={slowestChartData}
						/>
						<AnalyticsMostFailingCard
							viewMode={viewMode}
							limit={limit}
							mostFailing={mostFailing}
							mostFailingChartData={mostFailingChartData}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
