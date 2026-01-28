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
import { Cell, Label, Pie, PieChart } from 'recharts';
import { chartConfig } from '@/components/analytics/chartConfig';
import { formatCount } from '@/components/analytics/utils';

type PieDatum = {
	key: string;
	name: string;
	value: number;
};

type AnalyticsOverviewCardProps = {
	viewMode: 'table' | 'chart';
	pieData: PieDatum[];
	totalTests: number;
};

export function AnalyticsOverviewCard({
	viewMode,
	pieData,
	totalTests,
}: AnalyticsOverviewCardProps) {
	return (
		<Card className='bg-muted text-foreground'>
			<CardHeader className='space-y-0'>
				<CardTitle>Test results overview</CardTitle>
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
							<ChartContainer className='h-full w-full' config={chartConfig}>
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
										<Label
											content={({ viewBox }) => {
												if (!viewBox || !('cx' in viewBox)) return null;
												const { cx, cy } = viewBox as {
													cx: number;
													cy: number;
												};
												const yOffset = cy - 14;
												return (
													<g transform={`translate(${cx}, ${yOffset})`}>
														<text textAnchor='middle' dominantBaseline='middle'>
															<tspan
																x={0}
																dy='0'
																className='fill-foreground text-2xl font-semibold'>
																{formatCount(totalTests)}
															</tspan>
															<tspan
																x={0}
																dy='18'
																className='fill-muted-foreground text-xs'>
																tests
															</tspan>
														</text>
													</g>
												);
											}}
										/>
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
	);
}
