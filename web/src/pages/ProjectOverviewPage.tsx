import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import {
	ApiError,
	type Project,
	getProject,
	updateProject,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageError, PageLoading } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';

function formatDate(iso: string) {
	const d = new Date(iso);
	return d.toLocaleString();
}

export function ProjectOverviewPage() {
	const { projectId } = useParams();
	const pid = projectId ?? 'demo';
	const { apiKey, hasApiKey } = useAuth();

	const [project, setProject] = React.useState<Project | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	// Edit state
	const [isEditing, setIsEditing] = React.useState(false);
	const [editName, setEditName] = React.useState('');
	const [editSlug, setEditSlug] = React.useState('');
	const [updating, setUpdating] = React.useState(false);
	const [updateError, setUpdateError] = React.useState<string | null>(null);

	const refresh = React.useCallback(async () => {
		if (!hasApiKey) {
			setProject(null);
			setLoading(false);
			setError(null);
			setLastError(null);
			return;
		}

		setLoading(true);
		setError(null);
		setLastError(null);

		try {
			const data = await getProject(pid);
			setProject(data);
			setEditName(data.name);
			setEditSlug(data.slug);
		} catch (e) {
			setLastError(e);
			setError(e instanceof Error ? e.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}, [pid, hasApiKey]);

	React.useEffect(() => {
		void refresh();
	}, [refresh, apiKey]);

	async function onSaveChanges(e: React.FormEvent) {
		e.preventDefault();
		if (!hasApiKey || !project) return;

		setUpdateError(null);
		setUpdating(true);

		try {
			if (!editName.trim() || !editSlug.trim()) {
				setUpdateError('Name and slug are required');
				return;
			}

			await updateProject(project.id, {
				name: editName.trim(),
				slug: editSlug.trim(),
			});

			await refresh();
			setIsEditing(false);
		} catch (e) {
			if (e instanceof ApiError) {
				setUpdateError(e.message);
			} else if (e instanceof Error) {
				setUpdateError(e.message);
			} else {
				setUpdateError('Failed to update project');
			}
		} finally {
			setUpdating(false);
		}
	}

	function onCancelEdit() {
		if (project) {
			setEditName(project.name);
			setEditSlug(project.slug);
		}
		setUpdateError(null);
		setIsEditing(false);
	}

	const showAuthCallout =
		!hasApiKey || (lastError instanceof ApiError && lastError.status === 401);

	return (
		<div className='space-y-6'>
			<div>
				<h1 className='text-xl font-semibold'>Project Overview</h1>
				<p className='text-sm text-muted-foreground'>
					View and edit project details.
				</p>
			</div>

			{showAuthCallout ? <AuthRequiredCallout /> : null}

			{error ? (
				<PageError
					title='Project'
					message={error}
					onRetry={() => void refresh()}
				/>
			) : loading ? (
				<PageLoading title='Project' />
			) : !hasApiKey ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					Set an API key in Settings to view project details.
				</div>
			) : !project ? (
				<div className='rounded-md border p-6 text-sm text-muted-foreground'>
					Project not found.
				</div>
			) : (
				<div className='space-y-6'>
					{/* Project info card */}
					<div className='rounded-md border p-6 space-y-4'>
						<div className='flex items-center justify-between'>
							<h2 className='text-lg font-medium'>Project Details</h2>
							{!isEditing ? (
								<Button
									variant='outline'
									size='sm'
									onClick={() => setIsEditing(true)}>
									Edit
								</Button>
							) : null}
						</div>

						{!isEditing ? (
							<div className='space-y-3'>
								<div>
									<label className='text-xs font-medium text-muted-foreground'>
										Name
									</label>
									<p className='text-sm'>{project.name}</p>
								</div>

								<div>
									<label className='text-xs font-medium text-muted-foreground'>
										Slug
									</label>
									<p className='text-sm font-mono'>{project.slug}</p>
								</div>

								<div>
									<label className='text-xs font-medium text-muted-foreground'>
										Created
									</label>
									<p className='text-sm'>{formatDate(project.createdAt)}</p>
								</div>

								<div>
									<label className='text-xs font-medium text-muted-foreground'>
										ID
									</label>
									<p className='text-sm font-mono text-muted-foreground'>
										{project.id}
									</p>
								</div>
							</div>
						) : (
							<form onSubmit={onSaveChanges} className='space-y-4'>
								<div className='space-y-1'>
									<label className='text-xs font-medium' htmlFor='edit-name'>
										Name
									</label>
									<Input
										id='edit-name'
										placeholder='Project name'
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										disabled={updating}
									/>
								</div>

								<div className='space-y-1'>
									<label className='text-xs font-medium' htmlFor='edit-slug'>
										Slug
									</label>
									<Input
										id='edit-slug'
										placeholder='project-slug'
										value={editSlug}
										onChange={(e) => setEditSlug(e.target.value)}
										disabled={updating}
									/>
									<p className='text-[11px] text-muted-foreground'>
										Used in URLs and API calls.
									</p>
								</div>

								{updateError ? (
									<p className='text-xs text-destructive'>{updateError}</p>
								) : null}

								<div className='flex gap-2'>
									<Button type='submit' disabled={updating}>
										{updating ? 'Saving…' : 'Save Changes'}
									</Button>
									<Button
										type='button'
										variant='outline'
										onClick={onCancelEdit}
										disabled={updating}>
										Cancel
									</Button>
								</div>
							</form>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
