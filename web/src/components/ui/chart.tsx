import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

import { cn } from '@/lib/utils';

const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
	[k in string]: {
		label?: React.ReactNode;
		icon?: React.ComponentType;
	} & (
		| { color?: string; theme?: never }
		| { color?: never; theme: Record<keyof typeof THEMES, string> }
	);
};

type ChartContextProps = {
	config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
	const context = React.useContext(ChartContext);
	if (!context) {
		throw new Error('Chart components must be used within ChartContainer');
	}
	return context;
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
	const colorConfig = Object.entries(config).filter(
		([, item]) => item.theme || item.color,
	);

	if (!colorConfig.length) return null;

	return (
		<style
			dangerouslySetInnerHTML={{
				__html: Object.entries(THEMES)
					.map(
						([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
	.map(([key, item]) => {
		const color = item.theme?.[theme as keyof typeof THEMES] ?? item.color;
		return color ? `  --color-${key}: ${color};` : null;
	})
	.filter(Boolean)
	.join('\n')}
}
`,
					)
					.join('\n'),
			}}
		/>
	);
}

const ChartContainer = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> & {
		config: ChartConfig;
		children: React.ComponentProps<
			typeof RechartsPrimitive.ResponsiveContainer
		>['children'];
		id?: string;
	}
>(({ id, className, children, config, ...props }, ref) => {
	const uniqueId = React.useId();
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				ref={ref}
				data-chart={chartId}
				className={cn('h-full w-full', className)}
				{...props}>
				<ChartStyle id={chartId} config={config} />
				<RechartsPrimitive.ResponsiveContainer>
					{children}
				</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
});
ChartContainer.displayName = 'ChartContainer';

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
		React.ComponentProps<'div'> & {
			hideLabel?: boolean;
			hideIndicator?: boolean;
			indicator?: 'line' | 'dot' | 'dashed';
			nameKey?: string;
			labelKey?: string;
		}
>(
	(
		{
			active,
			payload,
			className,
			indicator = 'dot',
			hideLabel = false,
			hideIndicator = false,
			label,
			labelFormatter,
			labelClassName,
			formatter,
			nameKey,
			labelKey,
		},
		ref,
	) => {
		const { config } = useChart();

		if (!active || !payload?.length) return null;

		const labelValue = (() => {
			if (hideLabel) return null;
			if (labelFormatter) return labelFormatter(label, payload);
			if (labelKey) {
				const item = payload[0] as any;
				return item?.payload?.[labelKey] ?? label;
			}
			return label;
		})();

		return (
			<div
				ref={ref}
				className={cn(
					'grid min-w-[8rem] items-start gap-1.5 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md',
					className,
				)}>
				{labelValue != null ? (
					<div
						className={cn('text-[11px] text-muted-foreground', labelClassName)}>
						{String(labelValue)}
					</div>
				) : null}
				<div className='grid gap-1'>
					{payload
						.filter((item) => item.type !== 'none')
						.map((item) => {
							const key = String(nameKey ?? item.dataKey ?? 'value');
							const itemConfig = getPayloadConfigFromPayload(config, item, key);
							const color =
								item.color ?? itemConfig?.color ?? `var(--color-${key})`;
							const name = itemConfig?.label ?? item.name ?? key;

							let displayValue: React.ReactNode = item.value;
							let displayName: React.ReactNode = name;

							if (formatter) {
								const formatted = formatter(
									item.value,
									item.dataKey ?? name,
									item,
									payload.indexOf(item),
								);
								if (Array.isArray(formatted)) {
									[displayValue, displayName] = formatted;
								} else if (formatted != null) {
									displayValue = formatted;
								}
							}

							return (
								<div
									key={key}
									className='flex items-center justify-between gap-3'>
									<div className='flex items-center gap-2'>
										{!hideIndicator ? (
											<span
												className={cn(
													'h-2.5 w-2.5 rounded-full',
													indicator === 'line' && 'h-0.5 w-4 rounded',
													indicator === 'dashed' &&
														'h-0.5 w-4 rounded border border-dashed',
												)}
												style={{
													background:
														indicator === 'dashed' ? 'transparent' : color,
													borderColor: color,
												}}
											/>
										) : null}
										<span>{displayName}</span>
									</div>
									<span className='font-mono tabular-nums'>{displayValue}</span>
								</div>
							);
						})}
				</div>
			</div>
		);
	},
);
ChartTooltipContent.displayName = 'ChartTooltip';

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<'div'> &
		Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
			hideIcon?: boolean;
			nameKey?: string;
		}
>(
	(
		{ className, hideIcon = false, payload, verticalAlign = 'bottom', nameKey },
		ref,
	) => {
		const { config } = useChart();
		if (!payload?.length) return null;

		return (
			<div
				ref={ref}
				className={cn(
					'flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground',
					verticalAlign === 'top' ? 'pb-2' : 'pt-2',
					className,
				)}>
				{payload
					.filter((item) => item.type !== 'none')
					.map((item) => {
						const key = String(nameKey ?? item.dataKey ?? 'value');
						const itemConfig = getPayloadConfigFromPayload(config, item, key);
						const color =
							item.color ?? itemConfig?.color ?? `var(--color-${key})`;
						const label = itemConfig?.label ?? item.value ?? key;

						return (
							<div key={key} className='flex items-center gap-2'>
								{hideIcon ? null : (
									<span
										className='h-2.5 w-2.5 rounded-full'
										style={{ backgroundColor: color }}
									/>
								)}
								<span>{label}</span>
							</div>
						);
					})}
			</div>
		);
	},
);
ChartLegendContent.displayName = 'ChartLegend';

function getPayloadConfigFromPayload(
	config: ChartConfig,
	payload: unknown,
	key: string,
) {
	if (typeof payload !== 'object' || payload === null) return undefined;

	const payloadRecord = payload as Record<string, any>;
	const itemPayload = payloadRecord.payload as Record<string, any> | undefined;

	if (itemPayload && typeof itemPayload === 'object') {
		const itemKey = itemPayload[key];
		if (itemKey && config[itemKey]) return config[itemKey];
	}

	if (config[key]) return config[key];
	return undefined;
}

export {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	ChartStyle,
};
