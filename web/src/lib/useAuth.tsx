/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import {
	AUTH_MODE_KEY,
	clearApiKey,
	getApiKey,
	getAuthMode,
	setApiKey,
	setAuthMode,
	type AuthMode,
} from '@/lib/auth';

type AuthState = {
	apiKey: string | null;
	hasApiKey: boolean;
	authMode: AuthMode;
	isSessionMode: boolean;
	isApiKeyMode: boolean;
	effectiveHasApiKey: boolean;
	refresh: () => void;
	setKey: (value: string) => void;
	clearKey: () => void;
	setModeSession: () => void;
	setModeApiKey: () => void;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [apiKey, setApiKeyState] = React.useState<string | null>(() =>
		getApiKey(),
	);
	const [authMode, setAuthModeState] = React.useState<AuthMode>(() =>
		getAuthMode(),
	);

	const refresh = React.useCallback(() => {
		setApiKeyState(getApiKey());
		setAuthModeState(getAuthMode());
	}, []);

	const setKey = React.useCallback((value: string) => {
		setApiKey(value);
		setApiKeyState(getApiKey());
		setAuthModeState(getAuthMode());
	}, []);

	const clearKeyFn = React.useCallback(() => {
		clearApiKey();
		setApiKeyState(null);
		setAuthModeState(getAuthMode());
	}, []);

	const setModeSession = React.useCallback(() => {
		setAuthMode('session');
		setAuthModeState('session');
	}, []);

	const setModeApiKey = React.useCallback(() => {
		setAuthMode('apiKey');
		setAuthModeState('apiKey');
	}, []);

	// keep in sync across tabs
	React.useEffect(() => {
		function onStorage(e: StorageEvent) {
			if (e.key === 'testhub.apiKey' || e.key === AUTH_MODE_KEY) refresh();
		}
		function onAuthChanged() {
			refresh();
		}
		window.addEventListener('storage', onStorage);
		window.addEventListener(
			'testhub.authChanged',
			onAuthChanged as EventListener,
		);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener(
				'testhub.authChanged',
				onAuthChanged as EventListener,
			);
		};
	}, [refresh]);

	const value: AuthState = {
		apiKey,
		hasApiKey: Boolean(apiKey),
		authMode,
		isSessionMode: authMode === 'session',
		isApiKeyMode: authMode === 'apiKey',
		effectiveHasApiKey: authMode === 'apiKey' && Boolean(apiKey),
		refresh,
		setKey,
		clearKey: clearKeyFn,
		setModeSession,
		setModeApiKey,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = React.useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
	return ctx;
}
