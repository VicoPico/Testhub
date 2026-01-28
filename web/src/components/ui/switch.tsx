import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@/lib/utils';

type SwitchProps = React.ComponentPropsWithoutRef<
	typeof SwitchPrimitives.Root
> & {
	size?: 'sm' | 'default';
};

const Switch = React.forwardRef<
	React.ElementRef<typeof SwitchPrimitives.Root>,
	SwitchProps
>(({ className, size = 'default', ...props }, ref) => {
	const rootClass = size === 'sm' ? 'h-4 w-8' : 'h-6 w-11';
	const thumbClass =
		size === 'sm'
			? 'h-3 w-3 data-[state=checked]:translate-x-4'
			: 'h-5 w-5 data-[state=checked]:translate-x-5';

	return (
		<SwitchPrimitives.Root
			className={cn(
				'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
				rootClass,
				className,
			)}
			{...props}
			ref={ref}>
			<SwitchPrimitives.Thumb
				className={cn(
					'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0',
					thumbClass,
				)}
			/>
		</SwitchPrimitives.Root>
	);
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
