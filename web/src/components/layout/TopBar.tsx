import * as React from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarNav } from './SidebarNav';
import { usePageTitle } from '@/lib/usePageTitle';

export function TopBar(props: { projectId: string }) {
	const pageTitle = usePageTitle();
	const [mobileOpen, setMobileOpen] = React.useState(false);

	return (
		<header className='sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
			<div className='h-full px-4 flex items-center justify-between gap-3'>
				<div className='flex items-center gap-2 min-w-0'>
					{/* Mobile sidebar */}
					<div className='md:hidden'>
						<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
							<SheetTrigger asChild>
								<Button variant='outline' size='sm' className='h-9 px-3'>
									Menu
								</Button>
							</SheetTrigger>
							<SheetContent side='left' className='p-0 w-72'>
								<div className='h-14 px-4 flex items-center border-b'>
									<span className='font-semibold'>Testhub</span>
								</div>
								<SidebarNav
									projectId={props.projectId}
									onNavigate={() => setMobileOpen(false)}
								/>
							</SheetContent>
						</Sheet>
					</div>

					<div className='min-w-0'>
						<div className='flex items-center gap-2 min-w-0'>
							<span className='font-semibold tracking-tight'>Testhub</span>
							<Badge variant='secondary' className='truncate max-w-[140px]'>
								{props.projectId}
							</Badge>
						</div>
						<div className='text-xs text-muted-foreground truncate'>
							{pageTitle}
						</div>
					</div>
				</div>

				{/* Search placeholder (desktop only) */}
				<div className='hidden md:flex flex-1 justify-center'>
					<div className='w-full max-w-md'>
						<Input placeholder='Search runs, tests, tags…' />
					</div>
				</div>
				<div className='flex items-center gap-2'>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
