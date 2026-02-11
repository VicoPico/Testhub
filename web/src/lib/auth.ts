const KEY = 'testhub.apiKey';
const MODE_KEY = 'testhub.authMode';

export type AuthMode = 'session' | 'apiKey';

export function getAuthMode(): AuthMode {
	try {
		const v = localStorage.getItem(MODE_KEY);
		return v === 'apiKey' ? 'apiKey' : 'session';
	} catch {
		return 'session';
	}
}

function setAuthMode(mode: AuthMode) {
	try {
		localStorage.setItem(MODE_KEY, mode);
	} catch {
		// ignore
	}
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

		// ⭐ NEW: switch app to API key mode
		setAuthMode('apiKey');
	} catch {
		// ignore
	}
}

export function clearApiKey(): void {
	try {
		localStorage.removeItem(KEY);

		// ⭐ NEW: go back to session mode
		setAuthMode('session');
	} catch {
		// ignore
	}
}
