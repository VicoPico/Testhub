import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { useSidebarState } from './useSidebarState';
import { listProjects, type Project } from '@/lib/api';

const LAST_PROJECT_KEY = 'lastProjectId';

function getStoredLastProject(): string | undefined {
	if (typeof window === 'undefined') return undefined;
	try {
		return localStorage.getItem(LAST_PROJECT_KEY) ?? undefined;
	} catch {
		return undefined;
	}
}

function setStoredLastProject(projectId: string): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(LAST_PROJECT_KEY, projectId);
	} catch {
		// ignore
	}
}

function clearStoredLastProject(): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.removeItem(LAST_PROJECT_KEY);
	} catch {
		// ignore
	}
}

export function AppShell() {
	const { projectId } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const [storedProjectId, setStoredProjectId] = useState<string | undefined>(
		() => getStoredLastProject(),
	);
	const [projects, setProjects] = useState<Project[]>([]);
	const [projectsLoaded, setProjectsLoaded] = useState(false);
	const [projectsError, setProjectsError] = useState(false);
	const [currentProjectId, setCurrentProjectId] = useState<
		string | undefined
	>();
	const [currentProjectLabel, setCurrentProjectLabel] = useState<
		string | undefined
	>();
	const hasProjects = projectsLoaded && !projectsError && projects.length > 0;
	const hasSelectedProject = Boolean(currentProjectLabel);
	const badgeText = hasSelectedProject
		? currentProjectLabel
		: hasProjects
			? 'Select Project'
			: 'Create Project';
	const legendText = hasSelectedProject
		? `Search within ${currentProjectLabel ?? ''}.`
		: hasProjects
			? 'Select a project to search.'
			: 'Create a project to start searching.';

	const refreshProjects = useCallback(() => {
		let cancelled = false;
		setProjectsLoaded(false);
		setProjectsError(false);
		listProjects()
			.then((res) => {
				if (cancelled) return;
				setProjects(res.items);
			})
			.catch(() => {
				if (cancelled) return;
				setProjects([]);
				setProjectsError(true);
			})
			.finally(() => {
				if (cancelled) return;
				setProjectsLoaded(true);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const cleanup = refreshProjects();
		function onProjectsChanged() {
			refreshProjects();
		}
		window.addEventListener(
			'testhub.projectsChanged',
			onProjectsChanged as EventListener,
		);
		return () => {
			cleanup?.();
			window.removeEventListener(
				'testhub.projectsChanged',
				onProjectsChanged as EventListener,
			);
		};
	}, [refreshProjects]);

	useEffect(() => {
		const desired = projectId ?? storedProjectId;
		if (!desired) {
			setCurrentProjectId(undefined);
			setCurrentProjectLabel(undefined);
			return;
		}

		if (!projectsLoaded || projectsError) return;
		const match = projects.find((p) => p.slug === desired || p.id === desired);

		if (match) {
			setCurrentProjectId(desired);
			setCurrentProjectLabel(match.name);
			if (projectId) {
				setStoredLastProject(projectId);
				setStoredProjectId(projectId);
			}
			return;
		}

		clearStoredLastProject();
		setStoredProjectId(undefined);
		setCurrentProjectId(undefined);
		setCurrentProjectLabel(undefined);
	}, [projectId, storedProjectId, projects, projectsLoaded]);

	const { collapsed, toggle } = useSidebarState(currentProjectId);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const isMac = navigator.platform.toLowerCase().includes('mac');
			const mod = isMac ? e.metaKey : e.ctrlKey;

			if (mod && e.key.toLowerCase() === 'b') {
				// Don't interfere while typing in inputs
				const el = document.activeElement;
				const isTyping =
					el instanceof HTMLInputElement ||
					el instanceof HTMLTextAreaElement ||
					(el instanceof HTMLElement && el.isContentEditable);

				if (isTyping) return;

				e.preventDefault();
				toggle();
			}
		}

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [toggle]);

	useEffect(() => {
		function onProjectNotFound() {
			clearStoredLastProject();
			setStoredProjectId(undefined);
			setCurrentProjectId(undefined);
			setCurrentProjectLabel(undefined);
			if (location.pathname === '/projects') return;
			navigate('/projects', { replace: true });
		}

		window.addEventListener(
			'testhub.projectNotFound',
			onProjectNotFound as EventListener,
		);
		return () =>
			window.removeEventListener(
				'testhub.projectNotFound',
				onProjectNotFound as EventListener,
			);
	}, [location.pathname, navigate]);

	return (
		<div className='min-h-screen'>
			<TopBar
				projectId={currentProjectId}
				badgeText={badgeText}
				isProjectSelected={hasSelectedProject}
				projectLabel={currentProjectLabel}
				legendText={legendText}
			/>

			<div className='flex h-[calc(100vh-56px)]'>
				<aside
					className={[
						'hidden md:block border-r h-[calc(100vh-56px)] transition-all duration-200',
						collapsed ? 'w-16' : 'w-64',
					].join(' ')}>
					<SidebarNav
						projectId={currentProjectId}
						collapsed={collapsed}
						onToggle={toggle}
					/>
				</aside>

				<main className='flex-1 p-6 overflow-y-auto'>
					<Outlet />
				</main>
			</div>
		</div>
	);
}
