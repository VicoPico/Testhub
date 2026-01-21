import * as React from 'react';
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

	const [projects, setProjects] = React.useState<Project[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	// Create form state
	const [name, setName] = React.useState('');
	const [slug, setSlug] = React.useState('');
	const [creating, setCreating] = React.useState(false);
	const [createError, setCreateError] = React.useState<string | null>(null);

	// Delete state
	const [deleting, setDeleting] = React.useState<string | null>(null);

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

		// Note: In a production app, you'd want to fetch the run count first
		// For now, we use a generic warning
		const confirmed = window.confirm(
			`Are you sure you want to delete "${project.name}"?\n\n` +
				`⚠️ WARNING: This will permanently delete:\n` +
				`• The project "${project.name}"\n` +
				`• All test runs in this project\n` +
				`• All test cases\n` +
				`• All test results\n\n` +
				`This action cannot be undone.`,
		);

		if (!confirmed) return;

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
			<div className='flex items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>Projects</h1>
					<p className='text-sm text-muted-foreground'>
						Manage projects in your organization.
					</p>
				</div>
			</div>

			{showAuthCallout ? <AuthRequiredCallout /> : null}

			{/* Create project form */}
			<div className='rounded-md border p-4 space-y-3'>
				<h2 className='text-sm font-medium'>Create a new project</h2>
				<p className='text-xs text-muted-foreground'>
					Choose a human-friendly name and a slug. The slug is used in URLs and
					CI.
				</p>

				<form
					className='grid gap-3 sm:grid-cols-[2fr,2fr,auto]'
					onSubmit={onCreateProject}>
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

					<div className='flex items-end'>
						<Button
							type='submit'
							disabled={creating || !hasApiKey}
							className='w-full sm:w-auto'>
							{creating ? 'Creating…' : 'Create'}
						</Button>
					</div>
				</form>

				{createError ? (
					<p className='text-xs text-destructive'>{createError}</p>
				) : null}
			</div>

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
								className='grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm'>
								<div className='col-span-4 font-medium truncate'>{p.name}</div>
								<div className='col-span-3 text-muted-foreground truncate'>
									{p.slug}
								</div>
								<div className='col-span-3 text-muted-foreground'>
									{formatDate(p.createdAt)}
								</div>
								<div className='col-span-2 flex justify-end gap-2'>
									<Button
										variant='outline'
										size='sm'
										onClick={() => onDeleteProject(p)}
										disabled={deleting === p.id}
										className='text-destructive hover:text-destructive'>
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
