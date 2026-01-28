import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	XAxis,
	YAxis,
} from 'recharts';
import type { AnalyticsTimeseriesItem } from '@/lib/api';
import { chartConfig } from '@/components/analytics/chartConfig';
import {
	formatCount,
	formatDay,
	formatDuration,
	normalizeValue,
} from '@/components/analytics/utils';

type TimeseriesChartDatum = {
	day: string;
	dayTs: number;
	passed: number;
	failed: number;
	error: number;
	skipped: number;
	total: number;
};

type AnalyticsTimeseriesCardProps = {
	viewMode: 'table' | 'chart';
	timeseriesView: 'bar' | 'area';
	onTimeseriesViewChange: (view: 'bar' | 'area') => void;
	timeseries: AnalyticsTimeseriesItem[];
	timeseriesChartData: TimeseriesChartDatum[];
	timeDomain?: [number, number];
};

export function AnalyticsTimeseriesCard({
	viewMode,
	timeseriesView,
	onTimeseriesViewChange,
	timeseries,
	timeseriesChartData,
	timeDomain,
}: AnalyticsTimeseriesCardProps) {
	return (
		<Card className='bg-muted text-foreground'>
			<CardHeader className='flex flex-row items-start justify-between gap-4 space-y-0'>
				<div>
					<CardTitle>Test results over time</CardTitle>
					<CardDescription>Daily totals by status</CardDescription>
				</div>
				{viewMode === 'chart' ? (
					<div className='flex items-center gap-2 text-xs text-muted-foreground'>
						<Switch
							size='sm'
							checked={timeseriesView === 'area'}
							onCheckedChange={(checked) =>
								onTimeseriesViewChange(checked ? 'area' : 'bar')
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
				) : (
					<div className='h-64 rounded-md border bg-background p-3 dark:bg-[rgb(20,25,28)]'>
						{timeseries.length ? (
							<ChartContainer className='h-full w-full' config={chartConfig}>
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
											stroke='var(--color-passed)'
											strokeWidth={1}
											radius={[4, 4, 0, 0]}
										/>
										<Bar
											dataKey='failed'
											stackId='a'
											fill='var(--color-failed)'
											stroke='var(--color-failed)'
											strokeWidth={1}
											radius={[4, 4, 0, 0]}
										/>
										<Bar
											dataKey='error'
											stackId='a'
											fill='var(--color-error)'
											stroke='var(--color-error)'
											strokeWidth={1}
											radius={[4, 4, 0, 0]}
										/>
										<Bar
											dataKey='skipped'
											stackId='a'
											fill='var(--color-skipped)'
											stroke='var(--color-skipped)'
											strokeWidth={1}
											radius={[4, 4, 0, 0]}
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
											stroke='var(--color-passed)'
											strokeWidth={1}
											type='monotone'
										/>
										<Area
											dataKey='failed'
											stackId='a'
											fill='url(#fillFailed)'
											stroke='var(--color-failed)'
											strokeWidth={1}
											type='monotone'
										/>
										<Area
											dataKey='error'
											stackId='a'
											fill='url(#fillError)'
											stroke='var(--color-error)'
											strokeWidth={1}
											type='monotone'
										/>
										<Area
											dataKey='skipped'
											stackId='a'
											fill='url(#fillSkipped)'
											stroke='var(--color-skipped)'
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
	);
}
