/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { clearApiKey, getApiKey, setApiKey } from '@/lib/auth';

type AuthState = {
	apiKey: string | null;
	hasApiKey: boolean;
	refresh: () => void;
	setKey: (value: string) => void;
	clearKey: () => void;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [apiKey, setApiKeyState] = React.useState<string | null>(() =>
		getApiKey()
	);

	const refresh = React.useCallback(() => {
		setApiKeyState(getApiKey());
	}, []);

	const setKey = React.useCallback((value: string) => {
		setApiKey(value);
		setApiKeyState(getApiKey());
	}, []);

	const clearKeyFn = React.useCallback(() => {
		clearApiKey();
		setApiKeyState(null);
	}, []);

	// keep in sync across tabs
	React.useEffect(() => {
		function onStorage(e: StorageEvent) {
			if (e.key === 'testhub.apiKey') refresh();
		}
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, [refresh]);

	const value: AuthState = {
		apiKey,
		hasApiKey: Boolean(apiKey),
		refresh,
		setKey,
		clearKey: clearKeyFn,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = React.useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
	return ctx;
}
