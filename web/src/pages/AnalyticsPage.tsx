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

export function AnalyticsPage() {
	const { projectId } = useParams();
	usePageTitle('Analytics');

	const { apiKey } = useAuth();
	const canLoad = Boolean(apiKey);

	const [days, setDays] = useState<number>(7);
	const limit = 20;

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
						<h2 className='text-base font-semibold'>Failures over time</h2>
						<p className='text-xs text-muted-foreground'>
							Daily totals by status
						</p>
					</div>
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
										<div className='text-right font-medium'>{d.totalCount}</div>
									</div>
								))
							) : (
								<div className='px-3 py-3 text-sm text-muted-foreground'>
									No data.
								</div>
							)}
						</div>
					</div>
				</section>

				<section className='grid gap-6 lg:grid-cols-2'>
					<div className='rounded-lg border bg-card p-4'>
						<h2 className='text-base font-semibold'>Slowest tests</h2>
						<p className='mt-1 text-xs text-muted-foreground'>
							Top {limit} by avg duration
						</p>
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
					</div>

					<div className='rounded-lg border bg-card p-4'>
						<h2 className='text-base font-semibold'>Most failing tests</h2>
						<p className='mt-1 text-xs text-muted-foreground'>
							Top {limit} by fail/error count
						</p>
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
					</div>
				</section>
			</div>
		</div>
	);
}
