export function looksLikeId(value: string) {
	// Good-enough heuristic for cuid() and similar
	return value.length >= 12 && /^[a-z0-9]+$/i.test(value);
}
