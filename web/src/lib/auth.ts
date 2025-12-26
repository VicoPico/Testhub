const KEY = 'testhub.apiKey';

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
	} catch {
		// ignore (storage may be unavailable)
	}
}

export function clearApiKey(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
