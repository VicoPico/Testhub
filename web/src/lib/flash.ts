const FLASH_BANNER_KEY = 'testhub.flash.banner';

export function setFlashBanner(message: string): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(FLASH_BANNER_KEY, message);
	} catch {
		// ignore
	}
}

export function getAndClearFlashBanner(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const message = sessionStorage.getItem(FLASH_BANNER_KEY);
		if (!message) return null;
		sessionStorage.removeItem(FLASH_BANNER_KEY);
		return message;
	} catch {
		return null;
	}
}
