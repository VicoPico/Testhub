import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import { ApiError, type Project, getProject, updateProject } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { PageError, PageLoading } from '@/components/common/PageState';
import { AuthRequiredCallout } from '@/components/common/AuthRequiredCallout';

function formatDate(iso: string) {
	const d = new Date(iso);
	return d.toLocaleString();
}

export function ProjectOverviewPage() {
	const { projectId } = useParams();
	const navigate = useNavigate();
	const pid = projectId ?? '';
	const { apiKey, hasApiKey } = useAuth();

	const [project, setProject] = React.useState<Project | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [lastError, setLastError] = React.useState<unknown>(null);

	// Edit state
	const [isEditing, setIsEditing] = React.useState(false);
	const [editName, setEditName] = React.useState('');
	const [editSlug, setEditSlug] = React.useState('');
	const [changeSlug, setChangeSlug] = React.useState(false);
	const [showConfirm, setShowConfirm] = React.useState(false);
	const [updating, setUpdating] = React.useState(false);
	const [updateError, setUpdateError] = React.useState<string | null>(null);

	function slugify(value: string) {
		return value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

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
			setChangeSlug(false);
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

	React.useEffect(() => {
		if (!changeSlug) return;
		const suggested = slugify(editName);
		if (suggested && suggested !== editSlug) {
			setEditSlug(suggested);
		}
	}, [changeSlug, editName]);

	async function applyUpdate() {
		if (!hasApiKey || !project) return;
		setUpdateError(null);
		setUpdating(true);

		try {
			if (!editName.trim()) {
				setUpdateError('Name is required');
				return;
			}

			const payload: { name: string; slug?: string } = {
				name: editName.trim(),
			};
			if (changeSlug) {
				if (!editSlug.trim()) {
					setUpdateError('Slug is required when changing slug');
					return;
				}
				payload.slug = editSlug.trim();
			}

			const updated = await updateProject(project.id, payload);
			setProject(updated);
			setEditName(updated.name);
			setEditSlug(updated.slug);
			setChangeSlug(false);
			setIsEditing(false);
			window.dispatchEvent(new CustomEvent('testhub.projectsChanged'));

			if (projectId && projectId !== updated.slug) {
				try {
					localStorage.setItem('lastProjectId', updated.slug);
				} catch {
					// ignore
				}
				const nextPath = `/projects/${encodeURIComponent(updated.slug)}`;
				navigate(nextPath, { replace: true });
			}
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
			setShowConfirm(false);
		}
	}

	async function onSaveChanges(e: React.FormEvent) {
		e.preventDefault();
		if (!hasApiKey || !project) return;

		const wantsSlugChange =
			changeSlug && editSlug.trim() && editSlug.trim() !== project.slug;
		if (wantsSlugChange) {
			setShowConfirm(true);
			return;
		}

		await applyUpdate();
	}

	function onCancelEdit() {
		if (project) {
			setEditName(project.name);
			setEditSlug(project.slug);
		}
		setUpdateError(null);
		setChangeSlug(false);
		setShowConfirm(false);
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

								<div className='rounded-md border p-3'>
									<div className='flex items-center justify-between gap-3'>
										<div>
											<div className='text-sm font-medium'>Advanced</div>
											<div className='text-xs text-muted-foreground'>
												Slug changes can impact URLs and integrations.
											</div>
										</div>
										<Switch
											checked={changeSlug}
											onCheckedChange={setChangeSlug}
											disabled={updating}
										/>
									</div>

									{changeSlug ? (
										<div className='mt-3 space-y-1'>
											<label
												className='text-xs font-medium'
												htmlFor='edit-slug'>
												New slug
											</label>
											<Input
												id='edit-slug'
												placeholder='project-slug'
												value={editSlug}
												onChange={(e) => setEditSlug(e.target.value)}
												disabled={updating}
											/>
											<p className='text-[11px] text-muted-foreground'>
												Old links keep working via slug aliases.
											</p>
										</div>
									) : null}
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

			<Dialog open={showConfirm} onOpenChange={setShowConfirm}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Change project slug?</DialogTitle>
						<DialogDescription>
							Changing the slug can impact URLs and integrations. Old links will
							continue to work via aliases.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setShowConfirm(false)}
							disabled={updating}>
							Cancel
						</Button>
						<Button onClick={applyUpdate} disabled={updating}>
							{updating ? 'Saving…' : 'Confirm change'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
