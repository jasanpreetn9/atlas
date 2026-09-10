<script lang="ts">
	// Compact row of icon buttons.

	export interface ActionSpec {
		icon: string;
		label?: string;
		on?: boolean;
		tone?: 'danger' | string;
		onClick?: () => void;
	}

	const ICONS: Record<string, string[]> = {
		monitor: ['M6 3h12v18l-6-4-6 4z'],
		search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M16.4 16.4 21 21'],
		isearch: ['M4 6h9M4 12h6M4 18h4', 'M16 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19.2 19.2 22 22'],
		import: ['M12 4v10', 'M8.5 10.5 12 14l3.5-3.5', 'M4 20h16'],
		del: ['M4 7h16', 'M9 7V4h6v3', 'M6.5 7 7.5 20h9L17.5 7'],
		refresh: ['M20.5 12a8.5 8.5 0 1 1-3.2-6.6', 'M21 4v5h-5'],
		history: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v4.5l3 1.8'],
		edit: ['M4 20h4L20 8l-4-4L4 16z'],
		block: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M6.5 17.5 17.5 6.5'],
		info: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 11v5.5', 'M12 7.8h.01'],
		pause: ['M9.5 5v14M14.5 5v14'],
		grab: ['M12 3v11', 'M8 10.5 12 14.5l4-4', 'M5 20h14']
	};

	let { actions = [] }: { actions?: ActionSpec[] } = $props();
</script>

<div style="display:flex;align-items:center;gap:2px">
	{#each actions as a (a.label ?? a.icon)}
		<button
			type="button"
			title={a.label ?? a.icon}
			aria-label={a.label ?? a.icon}
			class="at-hov"
			onclick={(e) => {
				e.stopPropagation();
				a.onClick?.();
			}}
			style="display:grid;place-items:center;width:23px;height:23px;padding:0;border-radius:6px;background:transparent;border:1px solid transparent;color:var(--muted);cursor:pointer;transition:background 120ms ease-out,color 120ms ease-out"
		>
			<svg
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill={a.on ? 'currentColor' : 'none'}
				stroke={a.on ? 'var(--text)' : a.tone === 'danger' ? 'var(--err)' : 'currentColor'}
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				{#each ICONS[a.icon] ?? ICONS.info as d}
					<path {d} />
				{/each}
			</svg>
		</button>
	{/each}
</div>
