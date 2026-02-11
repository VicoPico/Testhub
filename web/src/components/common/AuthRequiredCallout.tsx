import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/useAuth';

export function AuthRequiredCallout(props: { title?: string; body?: string }) {
	const { isApiKeyMode, effectiveHasApiKey } = useAuth();

	const title =
		props.title ?? (isApiKeyMode ? 'API key required' : 'Sign in required');
	const body =
		props.body ??
		(isApiKeyMode
			? effectiveHasApiKey
				? 'Your API key may be invalid or lacks access.'
				: 'Add an API key in Settings to continue.'
			: 'Sign in to continue.');
	const ctaHref = isApiKeyMode ? '/settings' : '/login';
	const ctaLabel = isApiKeyMode ? 'Go to Settings' : 'Go to Login';

	return (
		<div className='rounded-lg border bg-card p-4 space-y-2'>
			<div className='text-sm font-semibold'>{title}</div>
			<div className='text-sm text-muted-foreground'>{body}</div>
			<Button asChild size='sm' variant='outline'>
				<Link to={ctaHref}>{ctaLabel}</Link>
			</Button>
		</div>
	);
}
