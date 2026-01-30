import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	ApiError,
	getAuthConfig,
	loginEmailPassword,
	resendVerification,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [sent, setSent] = React.useState(false);
	const [allowSignup, setAllowSignup] = React.useState(false);

	React.useEffect(() => {
		getAuthConfig()
			.then((res) => setAllowSignup(res.allowSignup))
			.catch(() => setAllowSignup(false));
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSent(false);
		setLoading(true);

		try {
			await loginEmailPassword({ email, password });
			navigate('/projects', { replace: true });
		} catch (e) {
			if (e instanceof ApiError && e.status === 403) {
				setError(e.message);
				try {
					await resendVerification({ email });
					setSent(true);
				} catch {
					// ignore
				}
			} else {
				setError(e instanceof Error ? e.message : 'Login failed');
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className='mx-auto flex min-h-screen w-full max-w-md items-center px-6'>
			<Card className='w-full'>
				<CardHeader>
					<CardTitle>Sign in</CardTitle>
				</CardHeader>
				<CardContent>
					<form className='space-y-4' onSubmit={onSubmit}>
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
						<div className='space-y-1'>
							<label className='text-xs font-medium' htmlFor='password'>
								Password
							</label>
							<Input
								id='password'
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>
						{error ? (
							<div className='text-xs text-destructive'>{error}</div>
						) : null}
						{sent ? (
							<div className='text-xs text-muted-foreground'>
								Verification email sent. Check server logs in dev.
							</div>
						) : null}
						<Button type='submit' disabled={loading} className='w-full'>
							{loading ? 'Signing in...' : 'Sign in'}
						</Button>
					</form>
					<div className='mt-4 flex items-center justify-between text-xs text-muted-foreground'>
						<Link to='/reset-password'>Forgot password?</Link>
						{allowSignup ? <Link to='/register'>Create account</Link> : null}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
