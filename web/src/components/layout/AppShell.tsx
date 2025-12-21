import { Outlet, NavLink, useParams } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SidebarNav } from './SidebarNav';

export function AppShell() {
	const { projectId } = useParams();

	return (
		<div
			style={{
				display: 'grid',
				gridTemplateRows: '56px 1fr',
				height: '100vh',
			}}>
			<TopBar projectId={projectId ?? 'unknown'} />
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '240px 1fr',
					minHeight: 0,
				}}>
				<SidebarNav projectId={projectId ?? 'unknown'} />
				<main style={{ padding: 24, overflow: 'auto' }}>
					<Outlet />
					<div style={{ marginTop: 24, opacity: 0.6, fontSize: 12 }}>
						Quick links: <NavLink to='runs'>Runs</NavLink> ·{' '}
						<NavLink to='tests'>Tests</NavLink> ·{' '}
						<NavLink to='analytics'>Analytics</NavLink> ·{' '}
						<NavLink to='settings'>Settings</NavLink>
					</div>
				</main>
			</div>
		</div>
	);
}
