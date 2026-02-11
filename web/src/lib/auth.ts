const KEY = 'testhub.apiKey';
export const AUTH_MODE_KEY = 'testhub.authMode';

export type AuthMode = 'session' | 'apiKey';

function notifyAuthChanged() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('testhub.authChanged'));
}

function isAuthMode(value: string | null): value is AuthMode {
	return value === 'session' || value === 'apiKey';
}

export function getAuthMode(): AuthMode {
	try {
		const stored = localStorage.getItem(AUTH_MODE_KEY);
		if (isAuthMode(stored)) {
			if (stored === 'apiKey' && !getApiKey()) return 'session';
			return stored;
		}
	} catch {
		// ignore
	}

	return getApiKey() ? 'apiKey' : 'session';
}

export function setAuthMode(mode: AuthMode) {
	try {
		localStorage.setItem(AUTH_MODE_KEY, mode);
	} catch {
		// ignore
	}
	notifyAuthChanged();
}

export function clearAuthMode() {
	try {
		localStorage.removeItem(AUTH_MODE_KEY);
	} catch {
		// ignore
	}
	notifyAuthChanged();
}

export function getApiKey(): string | null {
	try {
		const v = localStorage.getItem(KEY);
		return v && v.trim().length > 0 ? v.trim() : null;
	} catch {
		return null;
	}
}

export function setApiKey(value: string): void {
	const v = value.trim();
	try {
		if (!v) return clearApiKey();

		localStorage.setItem(KEY, v);

		// switch app to API key mode
		setAuthMode('apiKey');
	} catch {
		// ignore
	}
	notifyAuthChanged();
}

export function clearApiKey(): void {
	try {
		localStorage.removeItem(KEY);

		// go back to session mode
		setAuthMode('session');
	} catch {
		// ignore
	}
	notifyAuthChanged();
}
