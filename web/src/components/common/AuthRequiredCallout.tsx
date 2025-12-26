import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function AuthRequiredCallout(props: { title?: string; body?: string }) {
	return (
		<div className='rounded-lg border bg-card p-4 space-y-2'>
			<div className='text-sm font-semibold'>
				{props.title ?? 'Authorization required'}
			</div>
			<div className='text-sm text-muted-foreground'>
				{props.body ??
					'This page needs an API key. Add one in Settings to continue.'}
			</div>
			<Button asChild size='sm' variant='outline'>
				<Link to='/projects/demo/settings'>Go to Settings</Link>
			</Button>
		</div>
	);
}
