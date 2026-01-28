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
import type { AnalyticsMostFailingTestItem } from '@/lib/api';
import { chartConfig } from '@/components/analytics/chartConfig';
import {
	formatCount,
	normalizeValue,
	truncateLabel,
} from '@/components/analytics/utils';

type MostFailingChartDatum = {
	name: string;
	suite: string;
	failed: number;
	error: number;
};

type AnalyticsMostFailingCardProps = {
	viewMode: 'table' | 'chart';
	limit: number;
	mostFailing: AnalyticsMostFailingTestItem[];
	mostFailingChartData: MostFailingChartDatum[];
};

export function AnalyticsMostFailingCard({
	viewMode,
	limit,
	mostFailing,
	mostFailingChartData,
}: AnalyticsMostFailingCardProps) {
	return (
		<Card className='bg-muted text-foreground'>
			<CardHeader className='space-y-0'>
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
							<ChartContainer className='h-full w-full' config={chartConfig}>
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
										stroke='var(--color-failed)'
										strokeWidth={1}
										name='Failed'
										radius={[0, 4, 4, 0]}
									/>
									<Bar
										dataKey='error'
										stackId='a'
										fill='var(--color-error)'
										stroke='var(--color-error)'
										strokeWidth={1}
										name='Error'
										radius={[0, 4, 4, 0]}
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
	);
}
