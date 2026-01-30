import * as React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarNav } from './SidebarNav';
import { usePageTitle } from '@/lib/usePageTitle';
import { searchProject, type SearchResponse } from '@/lib/api';

export function TopBar(props: {
	projectId?: string;
	projectLabel?: string;
	badgeText: string;
	legendText: string;
	isProjectSelected: boolean;
}) {
	const pageTitle = usePageTitle();
	const [mobileOpen, setMobileOpen] = React.useState(false);
	const [query, setQuery] = React.useState('');
	const [results, setResults] = React.useState<SearchResponse | null>(null);
	const [searchOpen, setSearchOpen] = React.useState(false);
	const [searchLoading, setSearchLoading] = React.useState(false);
	const [searchError, setSearchError] = React.useState<string | null>(null);
	const queryRef = React.useRef(query);

	React.useEffect(() => {
		queryRef.current = query;
	}, [query]);

	React.useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed || !props.projectId) {
			setResults(null);
			setSearchError(null);
			setSearchOpen(false);
			return;
		}

		const handle = window.setTimeout(async () => {
			setSearchLoading(true);
			try {
				const data = await searchProject(props.projectId, trimmed, 6);
				if (queryRef.current.trim() !== trimmed) return;
				setResults(data);
				setSearchError(null);
				setSearchOpen(true);
			} catch (e) {
				if (queryRef.current.trim() !== trimmed) return;
				setSearchError(e instanceof Error ? e.message : 'Search failed');
				setResults(null);
				setSearchOpen(true);
			} finally {
				setSearchLoading(false);
			}
		}, 250);

		return () => window.clearTimeout(handle);
	}, [query, props.projectId]);

	return (
		<header className='sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
			<div className='h-full px-4 flex items-center justify-between gap-3 bg-background'>
				<div className='flex items-center gap-2 min-w-0'>
					{/* Mobile sidebar */}
					<div className='md:hidden'>
						<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
							<SheetTrigger asChild>
								<Button variant='outline' size='sm' className='h-9 px-3'>
									Menu
								</Button>
							</SheetTrigger>
							<SheetContent side='left' className='p-0 w-72'>
								<div className='h-14 px-4 flex items-center border-b'>
									<span className='font-semibold'>Testhub</span>
								</div>
								<SidebarNav
									projectId={props.projectId}
									onNavigate={() => setMobileOpen(false)}
								/>
							</SheetContent>
						</Sheet>
					</div>

					<div className='min-w-0'>
						<div className='flex items-center gap-2 min-w-0'>
							<span className='font-semibold tracking-tight'>Testhub</span>
							<Badge
								variant='secondary'
								className={[
									'inline-flex items-center min-w-[140px] md:min-w-[160px]',
									props.isProjectSelected
										? 'truncate max-w-[60vw] md:max-w-[320px]'
										: '',
								].join(' ')}>
								{props.badgeText}
							</Badge>
						</div>
						<div className='text-xs text-muted-foreground truncate'>
							{pageTitle}
						</div>
					</div>
				</div>

				{/* Project search (desktop only) */}
				<div className='hidden md:flex flex-1 justify-center'>
					{props.projectId ? (
						<div className='relative w-full max-w-md'>
							<Input
								placeholder='Search runs, tests, tags…'
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onFocus={() => {
									if (query.trim()) setSearchOpen(true);
								}}
								onBlur={() => {
									window.setTimeout(() => setSearchOpen(false), 150);
								}}
								className='transition-shadow hover:shadow-md hover:ring-1 hover:ring-ring/40 hover:bg-muted/40'
							/>
							{searchOpen ? (
								<div className='absolute left-0 right-0 top-full z-50 mt-2 rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-md'>
									{searchLoading ? (
										<div className='px-2 py-2 text-xs text-muted-foreground'>
											Searching…
										</div>
									) : searchError ? (
										<div className='px-2 py-2 text-xs text-destructive'>
											{searchError}
										</div>
									) : results ? (
										<div className='space-y-3'>
											<div>
												<div className='px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
													Tests
												</div>
												<div className='mt-1 space-y-1'>
													{results.tests.length ? (
														results.tests.map((t) => (
															<Link
																key={t.id}
																to={`/projects/${props.projectId}/tests?q=${encodeURIComponent(
																	t.externalId ?? t.name,
																)}`}
																className='flex items-center justify-between gap-3 rounded-md px-2 py-1 text-xs hover:bg-muted/40'>
																<div className='min-w-0'>
																	<div className='truncate font-medium'>
																		{t.name}
																	</div>
																	<div className='truncate text-[11px] text-muted-foreground'>
																		{t.externalId}
																	</div>
																</div>
																{t.lastStatus ? (
																	<span className='text-[11px] text-muted-foreground'>
																		{t.lastStatus}
																	</span>
																) : null}
															</Link>
														))
													) : (
														<div className='px-2 py-1 text-xs text-muted-foreground'>
															No test matches
														</div>
													)}
												</div>
											</div>

											<div>
												<div className='px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
													Runs
												</div>
												<div className='mt-1 space-y-1'>
													{results.runs.length ? (
														results.runs.map((r) => (
															<Link
																key={r.id}
																to={`/projects/${props.projectId}/runs/${r.id}`}
																className='flex items-center justify-between gap-3 rounded-md px-2 py-1 text-xs hover:bg-muted/40'>
																<div className='min-w-0'>
																	<div className='truncate font-medium'>
																		{r.id}
																	</div>
																	<div className='truncate text-[11px] text-muted-foreground'>
																		{r.branch ?? '—'}
																		{r.commitSha ? ` • ${r.commitSha}` : ''}
																	</div>
																</div>
																<span className='text-[11px] text-muted-foreground'>
																	{r.status}
																</span>
															</Link>
														))
													) : (
														<div className='px-2 py-1 text-xs text-muted-foreground'>
															No run matches
														</div>
													)}
												</div>
											</div>
										</div>
									) : (
										<div className='px-2 py-2 text-xs text-muted-foreground'>
											Type to search in this project.
										</div>
									)}
								</div>
							) : null}
						</div>
					) : (
						<div className='w-full max-w-md text-xs text-muted-foreground'>
							{props.legendText}
						</div>
					)}
				</div>
				<div className='flex items-center gap-2'>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
