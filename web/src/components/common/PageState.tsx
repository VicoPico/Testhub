import * as React from 'react';
import { Button } from '@/components/ui/button';

export function PageLoading(props: { title?: string }) {
	return (
		<div className='space-y-3'>
			{props.title ? (
				<h1 className='text-xl font-semibold'>{props.title}</h1>
			) : null}
			<div className='text-sm text-muted-foreground'>Loading…</div>
		</div>
	);
}

export function PageError(props: {
	title?: string;
	message: string;
	onRetry?: () => void;
	extra?: React.ReactNode;
}) {
	return (
		<div className='space-y-3'>
			{props.title ? (
				<h1 className='text-xl font-semibold'>{props.title}</h1>
			) : null}

			<div className='rounded-md border p-3 text-sm text-destructive'>
				<div>{props.message}</div>
				{props.extra ? <div className='mt-2'>{props.extra}</div> : null}
			</div>

			{props.onRetry ? (
				<div className='flex gap-2'>
					<Button variant='secondary' size='sm' onClick={props.onRetry}>
						Retry
					</Button>
				</div>
			) : null}
		</div>
	);
}
