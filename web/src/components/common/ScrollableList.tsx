import * as React from 'react';
import { cn } from '@/lib/utils';

type ScrollableListProps = {
	children: React.ReactNode;
	className?: string;
};

export function ScrollableList({ children, className }: ScrollableListProps) {
	return (
		<div className={cn('max-h-64 divide-y overflow-y-auto', className)}>
			{children}
		</div>
	);
}
