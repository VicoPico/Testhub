import { NavLink } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
	LayoutDashboard,
	PlayCircle,
	FlaskConical,
	BarChart3,
	Settings,
	PanelLeft,
	FolderKanban,
} from 'lucide-react';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

type SidebarNavProps = {
	// Optional: on /projects and /settings there is no active project
	projectId?: string;
	collapsed?: boolean;
	onNavigate?: () => void;
	onToggle?: () => void;
};

export function SidebarNav(props: SidebarNavProps) {
	const { projectId, collapsed, onNavigate, onToggle } = props;
	const base = projectId ? `/projects/${projectId}` : undefined;

	return (
		<div className='flex h-full flex-col px-3 py-4'>
			{/* Header */}
			<div className='mb-4 flex items-center justify-between px-2'>
				{!collapsed && (
					<span className='text-sm font-semibold tracking-tight'>Testhub</span>
				)}

				{onToggle && (
					<Button
						variant='ghost'
						size='icon'
						onClick={onToggle}
						aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						className='h-8 w-8'>
						<PanelLeft
							className={[
								'h-4 w-4 transition-transform duration-600',
								collapsed ? 'rotate-180' : 'rotate-0',
							].join(' ')}
						/>
					</Button>
				)}
			</div>

			<TooltipProvider delayDuration={200}>
				{/* Main nav (takes remaining height) */}
				<div className='flex-1 flex flex-col'>
					{/* Workspace-level nav */}
					<div className='mb-3 px-2 text-xs font-semibold tracking-tight text-muted-foreground'>
						Workspace
					</div>

					<nav className='flex flex-col gap-2'>
						<SidebarLink
							to='/projects'
							label='Projects'
							collapsed={collapsed}
							onNavigate={onNavigate}
							icon={<FolderKanban className='h-4 w-4 shrink-0' />}
						/>
					</nav>

					{/* Project-scoped nav */}
					{base && (
						<>
							<Separator className='my-3' />

							<div className='mb-3 px-2 text-xs font-semibold tracking-tight text-muted-foreground'>
								Project
							</div>

							<nav className='flex flex-1 flex-col gap-2'>
								<SidebarLink
									to={base}
									end
									label='Overview'
									collapsed={collapsed}
									onNavigate={onNavigate}
									icon={<LayoutDashboard className='h-4 w-4 shrink-0' />}
								/>

								<SidebarLink
									to={`${base}/runs`}
									label='Runs'
									collapsed={collapsed}
									onNavigate={onNavigate}
									icon={<PlayCircle className='h-4 w-4 shrink-0' />}
								/>

								<SidebarLink
									to={`${base}/tests`}
									label='Tests'
									collapsed={collapsed}
									onNavigate={onNavigate}
									icon={<FlaskConical className='h-4 w-4 shrink-0' />}
								/>

								<SidebarLink
									to={`${base}/analytics`}
									label='Analytics'
									collapsed={collapsed}
									onNavigate={onNavigate}
									icon={<BarChart3 className='h-4 w-4 shrink-0' />}
								/>
							</nav>
						</>
					)}
				</div>

				{/* Settings pinned to bottom */}
				<div className='mt-3'>
					<Separator className='mb-3' />
					<SidebarLink
						to='/settings'
						label='Settings'
						collapsed={collapsed}
						onNavigate={onNavigate}
						icon={<Settings className='h-4 w-4 shrink-0' />}
					/>
				</div>
			</TooltipProvider>
		</div>
	);
}

function SidebarLink(props: {
	to: string;
	label: string;
	icon: React.ReactNode;
	collapsed?: boolean;
	end?: boolean;
	onNavigate?: () => void;
}) {
	const link = (
		<NavLink
			to={props.to}
			end={props.end}
			onClick={() => props.onNavigate?.()}
			className={({ isActive }) =>
				[
					'group flex h-10 w-full items-center rounded-md text-sm font-medium transition-colors',
					props.collapsed ? 'justify-center px-2' : 'px-3 gap-2',
					isActive
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
				].join(' ')
			}>
			{props.icon}
			<span className={props.collapsed ? 'sr-only' : 'truncate'}>
				{props.label}
			</span>
		</NavLink>
	);

	if (!props.collapsed) return link;

	return (
		<Tooltip>
			<TooltipTrigger asChild>{link}</TooltipTrigger>
			<TooltipContent side='right' className='text-xs'>
				{props.label}
			</TooltipContent>
		</Tooltip>
	);
}
