import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVerifyEmailUrl } from '@/lib/api';

export function VerifyEmailPage() {
	const [params] = useSearchParams();
	const token = params.get('token');
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!token) return;
		try {
			window.location.href = getVerifyEmailUrl(token);
		} catch {
			setError('Failed to verify email');
		}
	}, [token]);

	return (
		<div className='mx-auto flex min-h-screen w-full max-w-md items-center px-6'>
			<Card className='w-full'>
				<CardHeader>
					<CardTitle>Email verification</CardTitle>
				</CardHeader>
				<CardContent>
					{error ? (
						<div className='text-sm text-destructive'>{error}</div>
					) : token ? (
						<div className='text-sm text-muted-foreground'>
							Verifying your email...
						</div>
					) : (
						<div className='text-sm text-muted-foreground'>
							Missing verification token.
						</div>
					)}
					<Button className='mt-4' asChild>
						<a href='/login'>Back to sign in</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
