import type { ChartConfig } from '@/components/ui/chart';

export const chartConfig: ChartConfig = {
	passed: {
		label: 'Passed',
		theme: { light: 'var(--test-passed)', dark: 'var(--test-passed)' },
	},
	failed: {
		label: 'Failed',
		theme: { light: 'var(--test-failed)', dark: 'var(--test-failed)' },
	},
	error: {
		label: 'Error',
		theme: { light: 'var(--test-error)', dark: 'var(--test-error)' },
	},
	skipped: {
		label: 'Skipped',
		theme: { light: 'var(--test-skipped)', dark: 'var(--test-skipped)' },
	},
	avg: {
		label: 'Avg (ms)',
		theme: { light: 'var(--test-slow)', dark: 'var(--test-slow)' },
	},
	max: {
		label: 'Max (ms)',
		theme: { light: 'var(--test-paused)', dark: 'var(--test-paused)' },
	},
};
