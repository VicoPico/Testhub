import { NavLink } from 'react-router-dom';

export function SidebarPlaceholder(props: { projectId: string }) {
	const base = `/projects/${props.projectId}`;

	const linkStyle = ({ isActive }: { isActive: boolean }) => ({
		display: 'block',
		padding: '10px 12px',
		borderRadius: 8,
		textDecoration: 'none',
		color: 'inherit',
		background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
	});

	return (
		<aside style={{ padding: 12, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
			<nav style={{ display: 'grid', gap: 6 }}>
				<NavLink to={base} end style={linkStyle}>
					Overview
				</NavLink>
				<NavLink to={`${base}/runs`} style={linkStyle}>
					Runs
				</NavLink>
				<NavLink to={`${base}/tests`} style={linkStyle}>
					Tests
				</NavLink>
				<NavLink to={`${base}/analytics`} style={linkStyle}>
					Analytics
				</NavLink>
				<NavLink to={`${base}/settings`} style={linkStyle}>
					Settings
				</NavLink>
			</nav>
		</aside>
	);
}
