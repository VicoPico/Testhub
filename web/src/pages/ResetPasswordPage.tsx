import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, forgotPassword, resetPassword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ResetPasswordPage() {
	const [params] = useSearchParams();
	const token = params.get('token') ?? '';
	const [email, setEmail] = React.useState('');
	const [newPassword, setNewPassword] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [success, setSuccess] = React.useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		setSuccess(false);

		try {
			if (token) {
				await resetPassword({ token, newPassword });
			} else {
				await forgotPassword({ email });
			}
			setSuccess(true);
		} catch (e) {
			if (e instanceof ApiError) {
				setError(e.message);
			} else {
				setError('Failed to reset password');
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className='mx-auto flex min-h-screen w-full max-w-md items-center px-6'>
			<Card className='w-full'>
				<CardHeader>
					<CardTitle>Reset password</CardTitle>
				</CardHeader>
				<CardContent>
					<form className='space-y-4' onSubmit={onSubmit}>
						{token ? (
							<div className='space-y-1'>
								<label className='text-xs font-medium' htmlFor='password'>
									New password
								</label>
								<Input
									id='password'
									type='password'
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									required
								/>
							</div>
						) : (
							<div className='space-y-1'>
								<label className='text-xs font-medium' htmlFor='email'>
									Email
								</label>
								<Input
									id='email'
									type='email'
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
								/>
							</div>
						)}
						{error ? (
							<div className='text-xs text-destructive'>{error}</div>
						) : null}
						{success ? (
							<div className='text-xs text-muted-foreground'>
								{token
									? 'Password updated. You can sign in again.'
									: 'Reset link sent. Check server logs in dev.'}
							</div>
						) : null}
						<Button type='submit' disabled={loading} className='w-full'>
							{loading
								? 'Submitting...'
								: token
									? 'Update password'
									: 'Send reset link'}
						</Button>
					</form>
					<div className='mt-4 text-xs text-muted-foreground'>
						<Link to='/login'>Back to sign in</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
