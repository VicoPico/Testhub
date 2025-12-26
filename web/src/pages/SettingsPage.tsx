// web/src/pages/SettingsPage.tsx
import * as React from 'react';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SettingsPage() {
	const { apiKey, hasApiKey, setKey, clearKey } = useAuth();

	const [draft, setDraft] = React.useState(apiKey ?? '');
	const [savedMsg, setSavedMsg] = React.useState<string | null>(null);

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
