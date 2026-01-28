const compactNumber = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1,
});

export function ms(n: number | null | undefined) {
	if (n == null) return '—';
	return `${Math.round(n)}ms`;
}

export function formatCount(value: number | string | null | undefined) {
	const n = typeof value === 'number' ? value : Number(value ?? 0);
	return Number.isFinite(n) ? compactNumber.format(n) : '0';
}

export function formatDuration(value: number | string | null | undefined) {
	const n = typeof value === 'number' ? value : Number(value ?? 0);
	if (!Number.isFinite(n)) return '—';
	if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
	return `${Math.round(n)}ms`;
}

export function normalizeValue(
	value: unknown,
): number | string | null | undefined {
	if (Array.isArray(value)) return value[0];
	return value as number | string | null | undefined;
}

export function truncateLabel(label: string) {
	if (label.length <= 18) return label;
	return `${label.slice(0, 16)}…`;
}

export function formatDay(value: number | string) {
	const ts = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(ts)) return '';
	return new Date(ts).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	});
}
