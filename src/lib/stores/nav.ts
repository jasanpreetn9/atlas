// Sidebar navigation config. Icon paths are copied from the design's NAV_ICONS.

export interface NavItem {
	key: string;
	label: string;
	href: string;
	paths: string[];
	/** Which badge count to show, if any. */
	badge?: 'library' | 'activity' | 'wanted' | 'system';
}

export const NAV_ITEMS: NavItem[] = [
	{ key: 'dash', label: 'Dashboard', href: '/', paths: ['M3 12 12 4l9 8', 'M5.5 10.5V20h13v-9.5'] },
	{
		key: 'lib',
		label: 'Library',
		href: '/library',
		paths: ['M4 4h6v16H4zM14 4h6v16h-6z'],
		badge: 'library'
	},
	{ key: 'add', label: 'Add New', href: '/add', paths: ['M12 5v14M5 12h14'] },
	{
		key: 'disc',
		label: 'Discover',
		href: '/discover',
		paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15 9l-2 4-4 2 2-4z']
	},
	{
		key: 'cal',
		label: 'Calendar',
		href: '/calendar',
		paths: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4M16 3v4']
	},
	{
		key: 'act',
		label: 'Activity',
		href: '/activity',
		paths: ['M3 12h4l2.5-6 4 12L16 12h5'],
		badge: 'activity'
	},
	{
		key: 'want',
		label: 'Wanted',
		href: '/wanted',
		paths: ['M12 3v11', 'M8 10.5 12 14.5l4-4', 'M4 20h16'],
		badge: 'wanted'
	},
	{
		key: 'sys',
		label: 'System',
		href: '/system',
		paths: ['M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M4 12h2M18 12h2M12 4v2M12 18v2'],
		badge: 'system'
	}
];

/** Which nav key is active for a given pathname. */
export function activeNavKey(pathname: string): string {
	if (pathname === '/') return 'dash';
	if (pathname.startsWith('/library')) return 'lib';
	if (pathname.startsWith('/add')) return 'add';
	if (pathname.startsWith('/discover')) return 'disc';
	if (pathname.startsWith('/calendar')) return 'cal';
	if (pathname.startsWith('/activity')) return 'act';
	if (pathname.startsWith('/wanted')) return 'want';
	if (pathname.startsWith('/system')) return 'sys';
	return '';
}
