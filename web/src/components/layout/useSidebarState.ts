import { useEffect, useMemo, useState } from 'react';

export function useSidebarState(projectId: string) {
	const storageKey = useMemo(
		() => `testhub.sidebar.collapsed.${projectId || 'unknown'}`,
		[projectId]
	);

	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		const raw = localStorage.getItem(storageKey);
		setCollapsed(raw === '1');
	}, [storageKey]);

	useEffect(() => {
		localStorage.setItem(storageKey, collapsed ? '1' : '0');
	}, [storageKey, collapsed]);

	return { collapsed, setCollapsed, toggle: () => setCollapsed((v) => !v) };
}
