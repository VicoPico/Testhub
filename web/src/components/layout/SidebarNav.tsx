import { NavLink } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';

export function SidebarNav(props: { projectId: string }) {
	const base = `/projects/${props.projectId}`;

	return (
		<div className='flex h-full flex-col px-3 py-4'>
			<div className='mb-3 px-2 text-xs font-semibold tracking-tight text-muted-foreground'>
				Project
			</div>

			<nav className='space-y-1'>
				<NavLink
					to={base}
					end
					className={({ isActive }) => navItemClass(isActive)}>
					Overview
				</NavLink>
				<NavLink
					to={`${base}/runs`}
					className={({ isActive }) => navItemClass(isActive)}>
					Runs
				</NavLink>
				<NavLink
					to={`${base}/tests`}
					className={({ isActive }) => navItemClass(isActive)}>
					Tests
				</NavLink>
				<NavLink
					to={`${base}/analytics`}
					className={({ isActive }) => navItemClass(isActive)}>
					Analytics
				</NavLink>

				<Separator className='my-3' />

				<NavLink
					to={`${base}/settings`}
					className={({ isActive }) => navItemClass(isActive)}>
					Settings
				</NavLink>
			</nav>
		</div>
	);
}

function navItemClass(isActive: boolean) {
	return [
		'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
		isActive
			? 'bg-muted text-foreground'
			: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
	].join(' ');
}
