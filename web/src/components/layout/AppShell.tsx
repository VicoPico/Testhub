import { Outlet, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { useSidebarState } from './useSidebarState';

export function AppShell() {
	const { projectId } = useParams();
	const [lastProjectId, setLastProjectId] = useState<string | undefined>(() => {
		if (typeof window === 'undefined') return undefined;
		try {
			return localStorage.getItem('lastProjectId') ?? undefined;
		} catch {
			return undefined;
		}
	});

	useEffect(() => {
		if (!projectId) return;
		setLastProjectId(projectId);
		try {
			localStorage.setItem('lastProjectId', projectId);
		} catch {
			// Ignore storage errors
		}
	}, [projectId]);

	const pid = projectId ?? lastProjectId;

	const { collapsed, toggle } = useSidebarState(pid);

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

	return (
		<div className='min-h-screen'>
			<TopBar projectId={pid} />

			<div className='flex h-[calc(100vh-56px)]'>
				<aside
					className={[
						'hidden md:block border-r h-[calc(100vh-56px)] transition-all duration-200',
						collapsed ? 'w-16' : 'w-64',
					].join(' ')}>
					<SidebarNav projectId={pid} collapsed={collapsed} onToggle={toggle} />
				</aside>

				<main className='flex-1 p-6 overflow-y-auto'>
					<Outlet />
				</main>
			</div>
		</div>
	);
}
