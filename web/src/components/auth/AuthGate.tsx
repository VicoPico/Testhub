import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getAuthMe, resendVerification } from '@/lib/api';

export function AuthGate({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const location = useLocation();
	const fromRef = React.useRef(`${location.pathname}${location.search}`);
	const [loading, setLoading] = React.useState(true);
	const [email, setEmail] = React.useState<string | undefined>();
	const [verified, setVerified] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [sent, setSent] = React.useState(false);
	const [authState, setAuthState] = React.useState<
		'loading' | 'authed' | 'unauthed'
	>('loading');

	React.useEffect(() => {
		fromRef.current = `${location.pathname}${location.search}`;
	}, [location.pathname, location.search]);

	const refreshAuth = React.useCallback(() => {
		let mounted = true;
		setLoading(true);
		setError(null);

		getAuthMe()
			.then((res) => {
				if (!mounted) return;
				if (!res) {
					setAuthState('unauthed');
					setVerified(true);
					setEmail(undefined);
					navigate('/login', {
						replace: true,
						state: { from: fromRef.current },
					});
					return;
				}
				setAuthState('authed');
				setVerified(res.emailVerified);
				setEmail(res.user?.email);
			})
			.catch((e) => {
				if (!mounted) return;
				setAuthState('unauthed');
				setError(e instanceof Error ? e.message : 'Failed to load session');
			})
			.finally(() => {
				if (!mounted) return;
				setLoading(false);
			});

		return () => {
			mounted = false;
		};
	}, [location.pathname, navigate]);

	React.useEffect(() => {
		const cleanup = refreshAuth();
		function onAuthChanged() {
			refreshAuth();
		}
		window.addEventListener(
			'testhub.authChanged',
			onAuthChanged as EventListener,
		);
		return () => {
			cleanup?.();
			window.removeEventListener(
				'testhub.authChanged',
				onAuthChanged as EventListener,
			);
		};
	}, [refreshAuth]);

	async function onResend() {
		if (!email) return;
		setSent(false);
		setError(null);
		try {
			await resendVerification({ email });
			setSent(true);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to resend');
		}
	}

	if (loading) {
		return (
			<div className='space-y-2'>
				<div className='text-sm text-muted-foreground'>Loading…</div>
			</div>
		);
	}

	if (authState === 'unauthed') {
		return null;
	}

	if (!verified) {
		return (
			<div className='max-w-xl space-y-3'>
				<Card>
					<CardContent className='space-y-2 py-4'>
						<div className='text-sm font-medium'>Verify your email</div>
						<div className='text-sm text-muted-foreground'>
							Check your inbox to verify your account before continuing.
						</div>
						{sent ? (
							<div className='text-xs text-muted-foreground'>
								Verification email sent. Check server logs in dev.
							</div>
						) : null}
						{error ? (
							<div className='text-xs text-destructive'>{error}</div>
						) : null}
						<Button size='sm' onClick={onResend} disabled={!email}>
							Resend verification
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error) {
		return <div className='text-sm text-destructive'>{error}</div>;
	}

	return <>{children}</>;
}
