// web/src/pages/SettingsPage.tsx
import * as React from 'react';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

export function SettingsPage() {
	const {
		apiKey,
		hasApiKey,
		authMode,
		setKey,
		clearKey,
		setModeSession,
		setModeApiKey,
	} = useAuth();

	const [draft, setDraft] = React.useState(apiKey ?? '');
	const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
	const [modeMsg, setModeMsg] = React.useState<string | null>(null);

	React.useEffect(() => {
		setDraft(apiKey ?? '');
	}, [apiKey]);

	function onSave() {
		setKey(draft.trim());
		setSavedMsg('API key saved.');
		window.setTimeout(() => setSavedMsg(null), 1500);
	}

	function onClear() {
		clearKey();
		setDraft('');
		setSavedMsg('API key cleared.');
		window.setTimeout(() => setSavedMsg(null), 1500);
	}

	function onModeChange(next: string) {
		if (next === 'apiKey') {
			if (!hasApiKey) {
				setModeMsg('Add an API key to enable API key mode.');
				window.setTimeout(() => setModeMsg(null), 2000);
				return;
			}
			setModeApiKey();
			setModeMsg('Using API key mode.');
			window.setTimeout(() => setModeMsg(null), 1500);
			return;
		}

		setModeSession();
		setModeMsg('Using session mode.');
		window.setTimeout(() => setModeMsg(null), 1500);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>Settings</h1>
				<p className='text-sm text-muted-foreground'>
					Project settings and ingestion docs coming soon.
				</p>
			</div>

			<div className='rounded-lg border bg-card p-4 space-y-3'>
				<div>
					<h2 className='text-sm font-semibold'>Authentication mode</h2>
					<p className='text-xs text-muted-foreground'>
						Choose how the app authenticates requests.
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-3'>
					<Select value={authMode} onValueChange={onModeChange}>
						<SelectTrigger className='w-[220px]'>
							<SelectValue placeholder='Select mode' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='session'>Session (browser login)</SelectItem>
							<SelectItem value='apiKey' disabled={!hasApiKey}>
								API key (CI / simulator)
							</SelectItem>
						</SelectContent>
					</Select>
					{!hasApiKey ? (
						<span className='text-xs text-muted-foreground'>
							Add an API key to enable API key mode.
						</span>
					) : null}
					{modeMsg ? (
						<span className='text-xs text-muted-foreground'>{modeMsg}</span>
					) : null}
				</div>
			</div>

			<div className='rounded-lg border bg-card p-4 space-y-3'>
				<div>
					<h2 className='text-sm font-semibold'>API key (dev)</h2>
					<p className='text-xs text-muted-foreground'>
						Stored locally in your browser. Do not paste real secrets into a
						repo.
					</p>
				</div>

				<Input
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder='Paste x-api-key value here'
					className='font-mono'
				/>

				<div className='flex flex-wrap items-center gap-2'>
					<Button onClick={onSave} disabled={draft.trim().length === 0}>
						Save key
					</Button>
					<Button variant='secondary' onClick={onClear} disabled={!hasApiKey}>
						Clear key
					</Button>

					{hasApiKey ? (
						<span className='text-xs text-muted-foreground'>
							Current: <span className='font-mono'>set</span>
						</span>
					) : (
						<span className='text-xs text-muted-foreground'>
							Current: <span className='font-mono'>not set</span>
						</span>
					)}

					{savedMsg ? (
						<span className='text-xs text-muted-foreground'>{savedMsg}</span>
					) : null}
				</div>
			</div>
		</div>
	);
}
