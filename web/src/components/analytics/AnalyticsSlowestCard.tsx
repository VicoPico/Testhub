import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { AnalyticsSlowTestItem } from '@/lib/api';
import { chartConfig } from '@/components/analytics/chartConfig';
import {
	formatCount,
	formatDay,
	formatDuration,
	ms,
	normalizeValue,
	truncateLabel,
} from '@/components/analytics/utils';

type SlowestChartDatum = {
	name: string;
	suite: string;
	avg: number;
	max: number;
};

type AnalyticsSlowestCardProps = {
	viewMode: 'table' | 'chart';
	limit: number;
	slowest: AnalyticsSlowTestItem[];
	slowestChartData: SlowestChartDatum[];
};

export function AnalyticsSlowestCard({
	viewMode,
	limit,
	slowest,
	slowestChartData,
}: AnalyticsSlowestCardProps) {
	return (
		<Card className='bg-muted text-foreground'>
			<CardHeader className='space-y-0'>
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
							<ChartContainer className='h-full w-full' config={chartConfig}>
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
										stroke='var(--color-avg)'
										strokeWidth={1}
										name='Avg (ms)'
										radius={[0, 4, 4, 0]}
									/>
									<Bar
										dataKey='max'
										fill='var(--color-max)'
										stroke='var(--color-max)'
										strokeWidth={1}
										name='Max (ms)'
										radius={[0, 4, 4, 0]}
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
	);
}
