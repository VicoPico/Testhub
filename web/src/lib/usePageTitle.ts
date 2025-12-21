import { useMatches } from 'react-router-dom';

type MatchWithHandle = {
	handle?: {
		title?: string;
	};
};

export function usePageTitle(defaultTitle = 'Testhub') {
	const matches = useMatches() as MatchWithHandle[];

	// pick the deepest match that has a title
	for (let i = matches.length - 1; i >= 0; i--) {
		const t = matches[i]?.handle?.title;
		if (t) return t;
	}
	return defaultTitle;
}
