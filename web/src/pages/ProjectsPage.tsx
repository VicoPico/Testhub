import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import {
	ApiError,
	type Project,
	listProjects,
	createProject,
	deleteProject,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageError, PageLoading } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';

function formatDate(iso: string) {
	const d = new Date(iso);
	return d.toLocaleString();
}

// Simple slugify helper for UX (doesn't change API contract)
function slugify(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function ProjectsPage() {
	const { apiKey, hasApiKey } = useAuth();
	const navigate = useNavigate();

	const [projects, setProjects] = React.useState<Project[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	// Create form state
	const [name, setName] = React.useState('');
	const [slug, setSlug] = React.useState('');
	const [creating, setCreating] = React.useState(false);
	const [createError, setCreateError] = React.useState<string | null>(null);
	const [createOpen, setCreateOpen] = React.useState(false);

	// Delete state
	const [deleting, setDeleting] = React.useState<string | null>(null);
	const [confirmProject, setConfirmProject] = React.useState<Project | null>(
		null,
	);
	const [confirmProjectFinal, setConfirmProjectFinal] =
		React.useState<Project | null>(null);

	const refresh = React.useCallback(async () => {
		if (!hasApiKey) {
			setProjects([]);
			setLoading(false);
			setError(null);
			setLastError(null);
			return;
		}

		setLoading(true);
		setError(null);
		setLastError(null);

		try {
			const data = await listProjects();
			setProjects(data.items);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}, [hasApiKey]);

	React.useEffect(() => {
		void refresh();
	}, [refresh, apiKey]);

	async function onCreateProject(e: React.FormEvent) {
		e.preventDefault();
		if (!hasApiKey) return;

		setCreateError(null);
		setLastError(null);
		setCreating(true);

		try {
			const fallbackSlug = slug || slugify(name);
			if (!name.trim() || !fallbackSlug.trim()) {
				setCreateError('Name and slug are required');
				return;
			}

			await createProject({
				name: name.trim(),
				slug: fallbackSlug.trim(),
			});

			setName('');
			setSlug('');
			setCreateOpen(false);
			await refresh();
		} catch (e) {
			setLastError(e);
			if (e instanceof ApiError) {
				setCreateError(e.message);
			} else if (e instanceof Error) {
				setCreateError(e.message);
			} else {
				setCreateError('Failed to create project');
			}
		} finally {
			setCreating(false);
		}
	}

	async function onDeleteProject(project: Project) {
		if (!hasApiKey) return;
		setConfirmProject(project);
	}

	async function onConfirmDeleteProject(project: Project) {
		if (!hasApiKey) return;

		setConfirmProjectFinal(null);
		setDeleting(project.id);
		setError(null);
		setLastError(null);

		try {
			await deleteProject(project.id);
			await refresh();
		} catch (e) {
			setLastError(e);
			if (e instanceof ApiError) {
				setError(`Failed to delete project: ${e.message}`);
			} else if (e instanceof Error) {
				setError(`Failed to delete project: ${e.message}`);
			} else {
				setError('Failed to delete project');
			}
		} finally {
			setDeleting(null);
		}
	}

	const showAuthCallout =
		!hasApiKey || (lastError instanceof ApiError && lastError.status === 401);

	return (
		<div className='space-y-6'>
			{confirmProject ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
					<div className='w-full max-w-xl rounded-lg border bg-muted dark:bg-muted p-5 shadow-lg'>
						<div className='flex items-start justify-between gap-4'>
							<div>
								<h2 className='text-base font-semibold'>Delete project</h2>
								<p className='text-xs text-muted-foreground'>
									This will permanently remove the project and all data inside.
								</p>
							</div>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => setConfirmProject(null)}>
								Close
							</Button>
						</div>

						<div className='mt-4 space-y-2 text-sm'>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Project</span>
								<span className='font-medium'>{confirmProject.name}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Slug</span>
								<span className='font-medium'>{confirmProject.slug}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Created</span>
								<span className='font-medium'>
									{formatDate(confirmProject.createdAt)}
								</span>
							</div>
							<div className='text-xs text-muted-foreground'>
								This deletes all test runs, test cases, and test results in this
								project.
							</div>
						</div>

						<div className='mt-6 flex items-center justify-end gap-2'>
							<Button
								variant='outline'
								onClick={() => setConfirmProject(null)}
								disabled={deleting === confirmProject.id}>
								Cancel
							</Button>
							<Button
								variant='destructive'
								onClick={() => {
									setConfirmProjectFinal(confirmProject);
									setConfirmProject(null);
								}}
								disabled={deleting === confirmProject.id}>
								Continue
							</Button>
						</div>
					</div>
				</div>
			) : null}
			{confirmProjectFinal ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
					<div className='w-full max-w-xl rounded-lg border bg-muted dark:bg-muted p-5 shadow-lg'>
						<div className='flex items-start justify-between gap-4'>
							<div>
								<h2 className='text-base font-semibold'>Confirm delete</h2>
								<p className='text-xs text-muted-foreground'>
									Are you really sure you want to delete this project? This is
									permanent.
								</p>
							</div>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => setConfirmProjectFinal(null)}>
								Close
							</Button>
						</div>

						<div className='mt-4 space-y-2 text-sm'>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Project</span>
								<span className='font-medium'>{confirmProjectFinal.name}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Slug</span>
								<span className='font-medium'>{confirmProjectFinal.slug}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Created</span>
								<span className='font-medium'>
									{formatDate(confirmProjectFinal.createdAt)}
								</span>
							</div>
						</div>

						<div className='mt-6 flex items-center justify-end gap-2'>
							<Button
								variant='outline'
								onClick={() => setConfirmProjectFinal(null)}
								disabled={deleting === confirmProjectFinal.id}>
								Cancel
							</Button>
							<Button
								variant='destructive'
								onClick={() => void onConfirmDeleteProject(confirmProjectFinal)}
								disabled={deleting === confirmProjectFinal.id}>
								Yes, delete
							</Button>
						</div>
					</div>
				</div>
			) : null}
			<div className='flex items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>Projects</h1>
					<p className='text-sm text-muted-foreground'>
						Manage projects in your organization.
					</p>
				</div>
				<Button
					onClick={() => {
						setName('');
						setSlug('');
						setCreateOpen(true);
						setCreateError(null);
					}}
					disabled={!hasApiKey}>
					Create Project
				</Button>
			</div>

			{showAuthCallout ? <AuthRequiredCallout /> : null}

			{createOpen ? (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
					<div className='w-full max-w-xl rounded-lg border bg-muted dark:bg-muted p-5 shadow-lg'>
						<div className='flex items-center justify-between gap-4'>
							<div>
								<h2 className='text-base font-semibold'>Create project</h2>
								<p className='text-xs text-muted-foreground'>
									Choose a name and slug. The slug is used in URLs and CI.
								</p>
							</div>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => {
									setCreateOpen(false);
									setCreateError(null);
								}}>
								Close
							</Button>
						</div>

						<form className='mt-4 grid gap-3' onSubmit={onCreateProject}>
							<div className='space-y-1'>
								<label className='text-xs font-medium' htmlFor='project-name'>
									Name
								</label>
								<Input
									id='project-name'
									placeholder='Demo project'
									value={name}
									onChange={(e) => setName(e.target.value)}
									disabled={creating || !hasApiKey}
								/>
							</div>

							<div className='space-y-1'>
								<label className='text-xs font-medium' htmlFor='project-slug'>
									Slug
								</label>
								<Input
									id='project-slug'
									placeholder='demo'
									value={slug}
									onChange={(e) => setSlug(e.target.value)}
									disabled={creating || !hasApiKey}
								/>
								<p className='text-[11px] text-muted-foreground'>
									Leave empty to auto-generate from the name.
								</p>
							</div>

							{createError ? (
								<p className='text-xs text-destructive'>{createError}</p>
							) : null}

							<div className='flex items-center justify-end gap-2'>
								<Button
									variant='outline'
									onClick={() => {
										setCreateOpen(false);
										setCreateError(null);
									}}
									disabled={creating}>
									Cancel
								</Button>
								<Button type='submit' disabled={creating || !hasApiKey}>
									{creating ? 'Creating…' : 'Create project'}
								</Button>
							</div>
						</form>
					</div>
				</div>
			) : null}

			{/* Projects list */}
			{error ? (
				<PageError
					title='Projects'
					message={error}
					onRetry={() => void refresh()}
				/>
			) : loading ? (
				<PageLoading title='Projects' />
			) : !hasApiKey ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					Set an API key in Settings to view projects.
				</div>
			) : projects.length === 0 ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					No projects yet. Create your first project above.
				</div>
			) : (
				<div className='overflow-hidden rounded-md border'>
					<div className='grid grid-cols-12 gap-2 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground'>
						<div className='col-span-4'>Name</div>
						<div className='col-span-3'>Slug</div>
						<div className='col-span-3'>Created</div>
						<div className='col-span-2 text-right'>Actions</div>
					</div>

					<div className='divide-y'>
						{projects.map((p) => (
							<div
								key={p.id}
								tabIndex={0}
								role='button'
								onClick={() =>
									navigate(`/projects/${encodeURIComponent(p.slug)}`)
								}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										navigate(`/projects/${encodeURIComponent(p.slug)}`);
									}
								}}
								className='grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'>
								<div className='col-span-4 font-medium truncate'>{p.name}</div>
								<div className='col-span-3 text-muted-foreground truncate'>
									{p.slug}
								</div>
								<div className='col-span-3 text-muted-foreground'>
									{formatDate(p.createdAt)}
								</div>
								<div className='col-span-2 flex justify-end gap-2'>
									<Button
										variant='secondary'
										size='sm'
										onClick={(e) => {
											e.stopPropagation();
											void onDeleteProject(p);
										}}
										disabled={deleting === p.id}
										className='hover:bg-destructive/20 hover:text-destructive'>
										{deleting === p.id ? 'Deleting…' : 'Delete'}
									</Button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
