// web/src/pages/RunDetailsPage.tsx

import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
	ApiError,
	batchIngestResults,
	getProject,
	getRun,
	listRunResults,
	type RunDetails,
	type RunResultItem,
	type TestStatus,
} from '@/lib/api';

import { PageError } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';
import { ScrollableList } from '@/components/common/ScrollableList';
import { useAuth } from '@/lib/useAuth';
import {
	getAndClearFlashBanner,
	setFlashBanner as persistFlashBanner,
} from '@/lib/flash';

function runStatusBadgeClass(status: RunDetails['status']) {
	switch (status) {
		case 'COMPLETED':
			return 'border-[color:var(--test-passed)] text-[color:var(--test-passed)] bg-[color-mix(in_oklch,var(--test-passed)_16%,transparent)]';
		case 'FAILED':
			return 'border-[color:var(--test-failed)] text-[color:var(--test-failed)] bg-[color-mix(in_oklch,var(--test-failed)_16%,transparent)]';
		case 'RUNNING':
		case 'QUEUED':
			return 'border-[color:var(--test-paused)] text-[color:var(--test-paused)] bg-[color-mix(in_oklch,var(--test-paused)_16%,transparent)]';
		case 'CANCELED':
			return 'border-[color:var(--test-skipped)] text-[color:var(--test-skipped)] bg-[color-mix(in_oklch,var(--test-skipped)_16%,transparent)]';
		default:
			return 'border-muted text-muted-foreground bg-transparent';
	}
}

function testStatusBadgeClass(status: TestStatus) {
	switch (status) {
		case 'PASSED':
			return 'border-[color:var(--test-passed)] text-[color:var(--test-passed)] bg-[color-mix(in_oklch,var(--test-passed)_16%,transparent)]';
		case 'FAILED':
			return 'border-[color:var(--test-failed)] text-[color:var(--test-failed)] bg-[color-mix(in_oklch,var(--test-failed)_16%,transparent)]';
		case 'ERROR':
			return 'border-[color:var(--test-error)] text-[color:var(--test-error)] bg-[color-mix(in_oklch,var(--test-error)_16%,transparent)]';
		case 'SKIPPED':
			return 'border-[color:var(--test-skipped)] text-[color:var(--test-skipped)] bg-[color-mix(in_oklch,var(--test-skipped)_16%,transparent)]';
		default:
			return 'border-muted text-muted-foreground bg-transparent';
	}
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleString();
}

function formatDuration(ms?: number | null) {
	if (ms == null) return '—';
	if (ms < 1000) return `${ms} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}

type StatusFilter = 'ALL' | TestStatus;

type ResultDraftRow = {
	externalId: string;
	name: string;
	status: TestStatus;
	durationMs: string; // user input
	tags: string; // comma-separated
	suiteName: string;
};

const ResultSchema = z.object({
	externalId: z.string().min(1, 'External ID is required.'),
	name: z.string().min(1, 'Name is required.'),
	status: z.enum(['PASSED', 'FAILED', 'SKIPPED', 'ERROR']),
	durationMs: z.number().int().min(0).optional(),
	tags: z.array(z.string()).optional(),
	suiteName: z.string().optional(),
});

const ResultListSchema = z.array(ResultSchema).min(1);

function emptyResultRow(): ResultDraftRow {
	return {
		externalId: '',
		name: '',
		status: 'PASSED',
		durationMs: '',
		tags: '',
		suiteName: '',
	};
}

export function RunDetailsPage() {
	const { projectId, runId } = useParams();
	const pid = projectId ?? '';
	const rid = runId ?? '';

	const { hasApiKey } = useAuth();

	const [run, setRun] = React.useState<RunDetails | null>(null);
	const [results, setResults] = React.useState<RunResultItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [projectName, setProjectName] = React.useState<string | null>(null);
	const [flashBanner, setFlashBannerState] = React.useState<string | null>(
		null,
	);

	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');

	const [sheetOpen, setSheetOpen] = React.useState(false);
	const [mode, setMode] = React.useState<'single' | 'multi'>('single');

	const [singleDraft, setSingleDraft] = React.useState<ResultDraftRow>(() =>
		emptyResultRow(),
	);
	const [multiDraft, setMultiDraft] = React.useState<ResultDraftRow[]>(() => [
		emptyResultRow(),
	]);

	const [submitting, setSubmitting] = React.useState(false);
	const [formError, setFormError] = React.useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = React.useState<
		Partial<Record<keyof ResultDraftRow, string>>
	>({});
	const [rowErrors, setRowErrors] = React.useState<
		Record<number, Partial<Record<keyof ResultDraftRow, string>>>
	>({});

	const draftKey = React.useMemo(() => {
		if (!rid) return null;
		return `testhub.runResultsDraft.${rid}`;
	}, [rid]);

	const isUnauthorized =
		lastError instanceof ApiError && lastError.status === 401;

	const refresh = React.useCallback(async () => {
		if (!pid || !rid) return;

		setLoading(true);
		setError(null);
		setLastError(null);

		try {
			const [runData, resultsData] = await Promise.all([
				getRun(pid, rid),
				listRunResults(pid, rid),
			]);

			setRun(runData);
			setResults(resultsData.items);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}, [pid, rid]);

	React.useEffect(() => {
		if (!pid || !rid) return;

		// This page currently depends on API key auth.
		if (!hasApiKey) {
			setRun(null);
			setResults([]);
			setLastError(null);
			setError(null);
			setLoading(false);
			return;
		}

		void refresh();
	}, [pid, rid, hasApiKey, refresh]);

	React.useEffect(() => {
		const banner = getAndClearFlashBanner();
		if (banner) setFlashBannerState(banner);
	}, []);

	React.useEffect(() => {
		if (!draftKey) return;
		try {
			const raw = localStorage.getItem(draftKey);
			if (!raw) return;
			const parsed = JSON.parse(raw) as {
				mode?: 'single' | 'multi';
				singleDraft?: ResultDraftRow;
				multiDraft?: ResultDraftRow[];
			};
			if (parsed.mode) setMode(parsed.mode);
			if (parsed.singleDraft) setSingleDraft(parsed.singleDraft);
			if (parsed.multiDraft?.length) setMultiDraft(parsed.multiDraft);
		} catch {
			// ignore
		}
	}, [draftKey]);

	React.useEffect(() => {
		if (!draftKey) return;
		try {
			localStorage.setItem(
				draftKey,
				JSON.stringify({ mode, singleDraft, multiDraft }),
			);
		} catch {
			// ignore
		}
	}, [draftKey, mode, singleDraft, multiDraft]);

	React.useEffect(() => {
		if (!pid || !hasApiKey) {
			setProjectName(null);
			return;
		}
		let cancelled = false;
		getProject(pid)
			.then((project) => {
				if (cancelled) return;
				setProjectName(project.name);
			})
			.catch(() => {
				if (cancelled) return;
				setProjectName(null);
			});
		return () => {
			cancelled = true;
		};
	}, [pid, hasApiKey]);

	const filteredResults =
		statusFilter === 'ALL'
			? results
			: results.filter((r) => r.status === statusFilter);

	const counts = React.useMemo(() => {
		const c = { PASSED: 0, FAILED: 0, SKIPPED: 0, ERROR: 0 } as Record<
			TestStatus,
			number
		>;
		for (const r of results) c[r.status] += 1;
		return c;
	}, [results]);

	function buildResult(row: ResultDraftRow) {
		const duration = row.durationMs.trim();
		const durationMs = duration ? Number(duration) : undefined;

		const tags = row.tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		return {
			externalId: row.externalId.trim(),
			name: row.name.trim(),
			status: row.status,
			durationMs,
			...(row.suiteName.trim() ? { suiteName: row.suiteName.trim() } : {}),
			...(tags.length ? { tags } : {}),
		};
	}

	async function submitResults() {
		if (!pid || !rid) return;

		setFormError(null);
		setFieldErrors({});
		setRowErrors({});
		setSubmitting(true);

		try {
			const payloads =
				mode === 'single'
					? [buildResult(singleDraft)]
					: multiDraft.map((row) => buildResult(row));

			if (mode === 'single') {
				const parsed = ResultSchema.safeParse(payloads[0]);
				if (!parsed.success) {
					const fields = parsed.error.flatten().fieldErrors;
					setFieldErrors({
						externalId: fields.externalId?.[0],
						name: fields.name?.[0],
						status: fields.status?.[0],
						durationMs: fields.durationMs?.[0],
						tags: fields.tags?.[0],
						suiteName: fields.suiteName?.[0],
					});
					return;
				}
			} else {
				const parsed = ResultListSchema.safeParse(payloads);
				if (!parsed.success) {
					const nextErrors: Record<
						number,
						Partial<Record<keyof ResultDraftRow, string>>
					> = {};

					for (const issue of parsed.error.issues) {
						// issue.path for array schema looks like: [rowIndex, fieldName]
						const rowIndex = issue.path[0];
						const field = issue.path[1];

						if (typeof rowIndex !== 'number') continue;
						if (typeof field !== 'string') continue;

						if (!nextErrors[rowIndex]) nextErrors[rowIndex] = {};
						nextErrors[rowIndex][field as keyof ResultDraftRow] = issue.message;
					}

					setRowErrors(nextErrors);
					return;
				}
			}

			await batchIngestResults(pid, rid, { results: payloads });
			await refresh();

			persistFlashBanner('Results added successfully.');
			setFlashBannerState('Results added successfully.');

			if (draftKey) {
				try {
					localStorage.removeItem(draftKey);
				} catch {
					// ignore
				}
			}

			setSingleDraft(emptyResultRow());
			setMultiDraft([emptyResultRow()]);
			setSheetOpen(false);
		} catch (e) {
			setFormError(e instanceof Error ? e.message : 'Failed to add results');
		} finally {
			setSubmitting(false);
		}
	}

	// Route params guard (separate from auth)
	if (!pid || !rid) {
		return (
			<div className='space-y-3'>
				<h1 className='text-xl font-semibold'>Run details</h1>
				<p className='text-sm text-muted-foreground'>
					Missing route params. Check your router path.
				</p>
			</div>
		);
	}

	// Auth guard
	if (!hasApiKey || isUnauthorized) {
		return (
			<div className='space-y-4'>
				<div className='flex items-center justify-between gap-3'>
					<div>
						<h1 className='text-xl font-semibold'>Run details</h1>
						<p className='text-sm text-muted-foreground'>
							This endpoint is protected.
						</p>
					</div>

					<Button asChild variant='outline' size='sm'>
						<Link to={`/projects/${pid}/runs`}>Back to runs</Link>
					</Button>
				</div>

				<AuthRequiredCallout />
			</div>
		);
	}

	if (loading) {
		return (
			<div className='space-y-4'>
				<div className='flex items-center justify-between gap-3'>
					<div className='space-y-1'>
						<div className='h-7 w-64 rounded bg-muted' />
						<div className='h-4 w-48 rounded bg-muted' />
					</div>
					<div className='h-9 w-28 rounded bg-muted' />
				</div>
				<div className='h-36 rounded-lg border bg-card' />
				<div className='h-72 rounded-lg border bg-card' />
			</div>
		);
	}

	if (error) {
		return (
			<PageError
				title='Run details'
				message={error}
				onRetry={() => void refresh()}
				extra={
					<div className='flex gap-2'>
						<Button asChild variant='outline' size='sm'>
							<Link to={`/projects/${pid}/runs`}>Back to runs</Link>
						</Button>
					</div>
				}
			/>
		);
	}

	if (!run) return null;

	return (
		<div className='space-y-6'>
			{flashBanner ? (
				<Card>
					<CardContent className='flex items-center justify-between gap-3 py-3'>
						<div className='text-sm text-foreground'>{flashBanner}</div>
						<Button
							variant='ghost'
							size='sm'
							onClick={() => setFlashBannerState(null)}>
							Dismiss
						</Button>
					</CardContent>
				</Card>
			) : null}

			<div className='flex items-start justify-between gap-4'>
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<h1 className='text-xl font-semibold tracking-tight'>
							Run{' '}
							<span className='font-mono text-base text-muted-foreground'>
								{run.id}
							</span>
						</h1>
						<Badge
							variant='outline'
							className={runStatusBadgeClass(run.status)}>
							{run.status}
						</Badge>
					</div>
					<p className='text-sm text-muted-foreground'>
						Created {formatDate(run.createdAt)} • Project{' '}
						<span className='font-medium'>{projectName ?? pid}</span>
					</p>
				</div>

				<div className='flex gap-2'>
					<Button variant='secondary' size='sm' onClick={() => void refresh()}>
						Refresh
					</Button>
					<Button asChild variant='outline' size='sm'>
						<Link to={`/projects/${pid}/runs`}>Back</Link>
					</Button>
				</div>
			</div>

			<div className='rounded-lg border bg-card p-4'>
				<div className='grid gap-3 md:grid-cols-3'>
					<div>
						<div className='text-xs font-medium text-muted-foreground'>
							Source
						</div>
						<div className='text-sm'>{run.source ?? '—'}</div>
					</div>
					<div>
						<div className='text-xs font-medium text-muted-foreground'>
							Branch
						</div>
						<div className='text-sm font-mono'>{run.branch ?? '—'}</div>
					</div>
					<div>
						<div className='text-xs font-medium text-muted-foreground'>
							Commit
						</div>
						<div className='text-sm font-mono'>{run.commitSha ?? '—'}</div>
					</div>
				</div>

				<Separator className='my-4' />

				<div className='grid gap-3 md:grid-cols-5'>
					<Stat label='Total' value={run.totalCount} />
					<Stat label='Passed' value={run.passedCount} />
					<Stat label='Failed' value={run.failedCount} />
					<Stat label='Skipped' value={run.skippedCount} />
					<Stat label='Errors' value={run.errorCount} />
				</div>
			</div>

			<div className='rounded-lg border bg-card p-4'>
				<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
					<div>
						<h2 className='text-sm font-semibold'>Results</h2>
						<p className='text-xs text-muted-foreground'>
							{results.length} total • {counts.PASSED} passed • {counts.FAILED}{' '}
							failed • {counts.SKIPPED} skipped • {counts.ERROR} errors
						</p>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<Button size='sm' onClick={() => setSheetOpen(true)}>
							Add Result
						</Button>
						<span className='text-xs text-muted-foreground'>Filter</span>
						<Select
							value={statusFilter}
							onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
							<SelectTrigger className='h-9 w-[180px]'>
								<SelectValue placeholder='All statuses' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='ALL'>All</SelectItem>
								<SelectItem value='PASSED'>Passed</SelectItem>
								<SelectItem value='FAILED'>Failed</SelectItem>
								<SelectItem value='SKIPPED'>Skipped</SelectItem>
								<SelectItem value='ERROR'>Error</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<Separator className='my-3' />

				{filteredResults.length === 0 ? (
					<div className='rounded-md border p-6 text-sm text-muted-foreground'>
						{results.length === 0
							? 'No results yet for this run.'
							: 'No results match the current filter.'}
					</div>
				) : (
					<div className='overflow-hidden rounded-md border'>
						<div className='grid grid-cols-12 gap-2 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground'>
							<div className='col-span-2'>Status</div>
							<div className='col-span-6'>Test</div>
							<div className='col-span-2'>Duration</div>
							<div className='col-span-2'>Message</div>
						</div>

						<ScrollableList>
							{filteredResults.map((r) => {
								const showMsg = r.status === 'FAILED' || r.status === 'ERROR';
								return (
									<div key={r.id} className='px-4 py-3'>
										<div className='grid grid-cols-12 items-start gap-2'>
											<div className='col-span-2'>
												<Badge
													variant='outline'
													className={testStatusBadgeClass(r.status)}>
													{r.status}
												</Badge>
											</div>

											<div className='col-span-6 min-w-0'>
												<div className='truncate font-medium'>
													{r.testCase.name}
												</div>
												<div className='truncate text-xs text-muted-foreground'>
													{r.testCase.suiteName ?? r.testCase.externalId}
												</div>

												{r.testCase.tags?.length ? (
													<div className='mt-2 flex flex-wrap gap-1'>
														{r.testCase.tags.slice(0, 8).map((t) => (
															<span
																key={t}
																className='rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground'>
																{t}
															</span>
														))}
														{r.testCase.tags.length > 8 && (
															<span className='text-[11px] text-muted-foreground'>
																+{r.testCase.tags.length - 8}
															</span>
														)}
													</div>
												) : null}
											</div>

											<div className='col-span-2 text-sm text-muted-foreground'>
												{formatDuration(r.durationMs)}
											</div>

											<div className='col-span-2 text-xs text-muted-foreground'>
												{showMsg && r.message ? (
													<span className='line-clamp-2'>{r.message}</span>
												) : (
													<span>—</span>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</ScrollableList>
					</div>
				)}
			</div>

			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent side='right' className='w-full sm:max-w-lg'>
					<SheetHeader>
						<SheetTitle>Add test results</SheetTitle>
						<SheetDescription>
							Enter results for this run. Required fields are marked.
						</SheetDescription>
					</SheetHeader>

					<Tabs
						value={mode}
						onValueChange={(v) => setMode(v as 'single' | 'multi')}>
						<TabsList className='mt-4'>
							<TabsTrigger value='single'>Single</TabsTrigger>
							<TabsTrigger value='multi'>Multiple</TabsTrigger>
						</TabsList>

						<TabsContent value='single' className='mt-4 space-y-3'>
							<div className='space-y-1'>
								<label className='text-xs font-medium'>External ID *</label>
								<Input
									value={singleDraft.externalId}
									onChange={(e) =>
										setSingleDraft((prev) => ({
											...prev,
											externalId: e.target.value,
										}))
									}
									placeholder='thermal/sensor-overheat'
								/>
								{fieldErrors.externalId ? (
									<p className='text-xs text-destructive'>
										{fieldErrors.externalId}
									</p>
								) : null}
							</div>

							<div className='space-y-1'>
								<label className='text-xs font-medium'>Name *</label>
								<Input
									value={singleDraft.name}
									onChange={(e) =>
										setSingleDraft((prev) => ({
											...prev,
											name: e.target.value,
										}))
									}
									placeholder='Thermal sensor overheat'
								/>
								{fieldErrors.name ? (
									<p className='text-xs text-destructive'>{fieldErrors.name}</p>
								) : null}
							</div>

							<div className='space-y-1'>
								<label className='text-xs font-medium'>Status *</label>
								<Select
									value={singleDraft.status}
									onValueChange={(v) =>
										setSingleDraft((prev) => ({
											...prev,
											status: v as TestStatus,
										}))
									}>
									<SelectTrigger>
										<SelectValue placeholder='Status' />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='PASSED'>PASSED</SelectItem>
										<SelectItem value='FAILED'>FAILED</SelectItem>
										<SelectItem value='SKIPPED'>SKIPPED</SelectItem>
										<SelectItem value='ERROR'>ERROR</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className='grid gap-3 sm:grid-cols-2'>
								<div className='space-y-1'>
									<label className='text-xs font-medium'>Duration (ms)</label>
									<Input
										value={singleDraft.durationMs}
										onChange={(e) =>
											setSingleDraft((prev) => ({
												...prev,
												durationMs: e.target.value,
											}))
										}
										placeholder='1200'
									/>
									{fieldErrors.durationMs ? (
										<p className='text-xs text-destructive'>
											{fieldErrors.durationMs}
										</p>
									) : null}
								</div>
								<div className='space-y-1'>
									<label className='text-xs font-medium'>Suite</label>
									<Input
										value={singleDraft.suiteName}
										onChange={(e) =>
											setSingleDraft((prev) => ({
												...prev,
												suiteName: e.target.value,
											}))
										}
										placeholder='Thermal'
									/>
								</div>
							</div>

							<div className='space-y-1'>
								<label className='text-xs font-medium'>Tags</label>
								<Input
									value={singleDraft.tags}
									onChange={(e) =>
										setSingleDraft((prev) => ({
											...prev,
											tags: e.target.value,
										}))
									}
									placeholder='thermal, sensor, stress'
								/>
								{fieldErrors.tags ? (
									<p className='text-xs text-destructive'>{fieldErrors.tags}</p>
								) : null}
							</div>
						</TabsContent>

						<TabsContent value='multi' className='mt-4 space-y-3'>
							<div className='space-y-3'>
								{multiDraft.map((row, index) => {
									const errors = rowErrors[index] ?? {};
									return (
										<div
											key={`row-${index}`}
											className='space-y-3 rounded-md border p-3'>
											<div className='flex items-center justify-between'>
												<div className='text-xs font-medium text-muted-foreground'>
													Result {index + 1}
												</div>
												<Button
													variant='ghost'
													size='sm'
													onClick={() =>
														setMultiDraft((prev) =>
															prev.filter((_, i) => i !== index),
														)
													}
													disabled={multiDraft.length === 1}>
													Remove
												</Button>
											</div>

											<div className='space-y-1'>
												<label className='text-xs font-medium'>
													External ID *
												</label>
												<Input
													value={row.externalId}
													onChange={(e) =>
														setMultiDraft((prev) =>
															prev.map((r, i) =>
																i === index
																	? { ...r, externalId: e.target.value }
																	: r,
															),
														)
													}
													placeholder='thermal/sensor-overheat'
												/>
												{errors.externalId ? (
													<p className='text-xs text-destructive'>
														{errors.externalId}
													</p>
												) : null}
											</div>

											<div className='space-y-1'>
												<label className='text-xs font-medium'>Name *</label>
												<Input
													value={row.name}
													onChange={(e) =>
														setMultiDraft((prev) =>
															prev.map((r, i) =>
																i === index
																	? { ...r, name: e.target.value }
																	: r,
															),
														)
													}
													placeholder='Thermal sensor overheat'
												/>
												{errors.name ? (
													<p className='text-xs text-destructive'>
														{errors.name}
													</p>
												) : null}
											</div>

											<div className='space-y-1'>
												<label className='text-xs font-medium'>Status *</label>
												<Select
													value={row.status}
													onValueChange={(v) =>
														setMultiDraft((prev) =>
															prev.map((r, i) =>
																i === index
																	? { ...r, status: v as TestStatus }
																	: r,
															),
														)
													}>
													<SelectTrigger>
														<SelectValue placeholder='Status' />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='PASSED'>PASSED</SelectItem>
														<SelectItem value='FAILED'>FAILED</SelectItem>
														<SelectItem value='SKIPPED'>SKIPPED</SelectItem>
														<SelectItem value='ERROR'>ERROR</SelectItem>
													</SelectContent>
												</Select>
												{errors.status ? (
													<p className='text-xs text-destructive'>
														{errors.status}
													</p>
												) : null}
											</div>

											<div className='grid gap-3 sm:grid-cols-2'>
												<div className='space-y-1'>
													<label className='text-xs font-medium'>
														Duration (ms)
													</label>
													<Input
														value={row.durationMs}
														onChange={(e) =>
															setMultiDraft((prev) =>
																prev.map((r, i) =>
																	i === index
																		? { ...r, durationMs: e.target.value }
																		: r,
																),
															)
														}
														placeholder='1200'
													/>
													{errors.durationMs ? (
														<p className='text-xs text-destructive'>
															{errors.durationMs}
														</p>
													) : null}
												</div>

												<div className='space-y-1'>
													<label className='text-xs font-medium'>Suite</label>
													<Input
														value={row.suiteName}
														onChange={(e) =>
															setMultiDraft((prev) =>
																prev.map((r, i) =>
																	i === index
																		? { ...r, suiteName: e.target.value }
																		: r,
																),
															)
														}
														placeholder='Thermal'
													/>
												</div>
											</div>

											<div className='space-y-1'>
												<label className='text-xs font-medium'>Tags</label>
												<Input
													value={row.tags}
													onChange={(e) =>
														setMultiDraft((prev) =>
															prev.map((r, i) =>
																i === index
																	? { ...r, tags: e.target.value }
																	: r,
															),
														)
													}
													placeholder='thermal, sensor, stress'
												/>
												{errors.tags ? (
													<p className='text-xs text-destructive'>
														{errors.tags}
													</p>
												) : null}
											</div>
										</div>
									);
								})}
							</div>

							<Button
								variant='outline'
								onClick={() =>
									setMultiDraft((prev) => [...prev, emptyResultRow()])
								}>
								Add another result
							</Button>
						</TabsContent>
					</Tabs>

					{formError ? (
						<p className='mt-3 text-xs text-destructive'>{formError}</p>
					) : null}

					<SheetFooter className='mt-6'>
						<Button variant='outline' onClick={() => setSheetOpen(false)}>
							Cancel
						</Button>
						<Button onClick={submitResults} disabled={submitting}>
							{submitting ? 'Saving…' : 'Save results'}
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	);
}

function Stat(props: { label: string; value: number }) {
	return (
		<div className='rounded-md bg-muted/40 px-3 py-2'>
			<div className='text-[11px] font-medium text-muted-foreground'>
				{props.label}
			</div>
			<div className='text-lg font-semibold leading-tight'>{props.value}</div>
		</div>
	);
}
