import * as React from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getAuthConfig, registerEmailPassword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function RegisterPage() {
	const [allowSignup, setAllowSignup] = React.useState(false);
	const [email, setEmail] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [fullName, setFullName] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [success, setSuccess] = React.useState(false);

	React.useEffect(() => {
		getAuthConfig()
			.then((res) => setAllowSignup(res.allowSignup))
			.catch(() => setAllowSignup(false));
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!allowSignup) return;
		setLoading(true);
		setError(null);
		setSuccess(false);

		try {
			await registerEmailPassword({
				email,
				password,
				fullName: fullName.trim() || undefined,
			});
			setSuccess(true);
		} catch (e) {
			if (e instanceof ApiError && e.status === 403) {
				setError('Signups are disabled.');
			} else {
				setError(e instanceof Error ? e.message : 'Registration failed');
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className='mx-auto flex min-h-screen w-full max-w-md items-center px-6'>
			<Card className='w-full'>
				<CardHeader>
					<CardTitle>Create account</CardTitle>
				</CardHeader>
				<CardContent>
					{!allowSignup ? (
						<div className='text-sm text-muted-foreground'>
							Self-registration is disabled.
						</div>
					) : (
						<form className='space-y-4' onSubmit={onSubmit}>
							<div className='space-y-1'>
								<label className='text-xs font-medium' htmlFor='fullName'>
									Full name
								</label>
								<Input
									id='fullName'
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
								/>
							</div>
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
							{success ? (
								<div className='text-xs text-muted-foreground'>
									Check server logs for the verification link.
								</div>
							) : null}
							<Button type='submit' disabled={loading} className='w-full'>
								{loading ? 'Creating...' : 'Create account'}
							</Button>
						</form>
					)}
					<div className='mt-4 text-xs text-muted-foreground'>
						<Link to='/login'>Back to sign in</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
