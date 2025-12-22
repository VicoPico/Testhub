import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
	const { theme, setTheme, systemTheme } = useTheme();

	// Avoid hydration mismatch / initial undefined theme
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	const resolvedTheme = theme === 'system' ? systemTheme : theme; // "light" | "dark" | undefined

	const isDark = mounted ? resolvedTheme === 'dark' : false;

	return (
		<Button
			variant='outline'
			size='sm'
			onClick={() => setTheme(isDark ? 'light' : 'dark')}
			className='h-9 gap-2'
			aria-label='Toggle theme'>
			{isDark ? <Moon className='h-4 w-4' /> : <Sun className='h-4 w-4' />}
			<span className='hidden sm:inline'>{isDark ? 'Dark' : 'Light'}</span>
		</Button>
	);
}
