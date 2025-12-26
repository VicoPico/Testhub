// api-ts/src/lib/apiKey.ts
import crypto from 'node:crypto';

export type ParsedApiKey = { prefix: string; raw: string };

export function sha256Hex(value: string): string {
	return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	// timingSafeEqual requires same-length buffers
	const bufA = Buffer.from(a, 'hex');
	const bufB = Buffer.from(b, 'hex');
	if (bufA.length !== bufB.length) return false;
	return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Expected format: "<prefix>.<secret>"
 * - prefix is stored in DB (lookup)
 * - secret is hashed and compared
 */
export function parseApiKey(value: string): ParsedApiKey | null {
	const v = value.trim();
	const i = v.indexOf('.');
	if (i <= 0 || i === v.length - 1) return null;

	const prefix = v.slice(0, i);
	const raw = v.slice(i + 1);

	// basic sanity checks
	if (prefix.length < 6) return null;
	if (raw.length < 16) return null;

	return { prefix, raw };
}

/**
 * Generates a new API key:
 * - plainText is what you show once to the user
 * - prefix is stored in DB and used for lookup
 * - hash is sha256(secret) stored in DB
 */
export function createApiKey(): {
	plainText: string;
	prefix: string;
	hash: string;
} {
	const prefix = crypto.randomBytes(8).toString('hex'); // 16 chars
	const secret = crypto.randomBytes(32).toString('hex'); // 64 chars

	const plainText = `${prefix}.${secret}`;
	const hash = sha256Hex(secret);

	return { plainText, prefix, hash };
}
