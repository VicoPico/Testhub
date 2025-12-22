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
} from 'lucide-react';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

type SidebarNavProps = {
	projectId: string;
	collapsed?: boolean;
	onNavigate?: () => void;
	onToggle?: () => void;
};

export function SidebarNav(props: SidebarNavProps) {
	const base = `/projects/${props.projectId}`;

	return (
		<div className='flex h-full flex-col px-3 py-4'>
			{/* Header */}
			<div className='mb-4 flex items-center justify-between px-2'>
				{!props.collapsed && (
					<span className='text-sm font-semibold tracking-tight'>Testhub</span>
				)}

				{props.onToggle && (
					<Button
						variant='ghost'
						size='icon'
						onClick={props.onToggle}
						aria-label={props.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						className='h-8 w-8'>
						<PanelLeft
							className={[
								'h-4 w-4 transition-transform duration-600',
								props.collapsed ? 'rotate-180' : 'rotate-0',
							].join(' ')}
						/>
					</Button>
				)}
			</div>

			<div className='mb-3 px-2 text-xs font-semibold tracking-tight text-muted-foreground'>
				Project
			</div>

			<TooltipProvider delayDuration={200}>
				<nav className='flex flex-1 flex-col gap-2'>
					<SidebarLink
						to={base}
						end
						label='Overview'
						collapsed={props.collapsed}
						onNavigate={props.onNavigate}
						icon={<LayoutDashboard className='h-4 w-4 shrink-0' />}
					/>

					<SidebarLink
						to={`${base}/runs`}
						label='Runs'
						collapsed={props.collapsed}
						onNavigate={props.onNavigate}
						icon={<PlayCircle className='h-4 w-4 shrink-0' />}
					/>

					<SidebarLink
						to={`${base}/tests`}
						label='Tests'
						collapsed={props.collapsed}
						onNavigate={props.onNavigate}
						icon={<FlaskConical className='h-4 w-4 shrink-0' />}
					/>

					<SidebarLink
						to={`${base}/analytics`}
						label='Analytics'
						collapsed={props.collapsed}
						onNavigate={props.onNavigate}
						icon={<BarChart3 className='h-4 w-4 shrink-0' />}
					/>

					<Separator className='my-3' />

					<SidebarLink
						to={`${base}/settings`}
						label='Settings'
						collapsed={props.collapsed}
						onNavigate={props.onNavigate}
						icon={<Settings className='h-4 w-4 shrink-0' />}
					/>
				</nav>
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
