import crypto from 'node:crypto';

export type ParsedApiKey = {
	prefix: string;
	raw: string;
};

/**
 * Example raw key: "test_12345678_deadbeef"
 * We store prefix "test_12345678" and sha256(raw full key)
 */
export function parseApiKey(raw: string): ParsedApiKey | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const parts = trimmed.split('_');
	// Require at least 3 parts so there is a secret component (prefix + secret)
	if (parts.length < 3) return null;

	const prefix = `${parts[0]}_${parts[1]}`;
	return { prefix, raw: trimmed };
}

export function sha256Hex(input: string) {
	return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Constant-time compare of two hex strings.
 * Returns false if lengths mismatch or non-hex content causes buffer mismatch.
 */
export function safeEqualHex(a: string, b: string) {
	if (a.length !== b.length) return false;

	const ab = Buffer.from(a, 'hex');
	const bb = Buffer.from(b, 'hex');

	if (ab.length !== bb.length) return false;
	return crypto.timingSafeEqual(ab, bb);
}
