<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/stores/store.svelte';
	import { NAV_ITEMS, activeNavKey } from '$lib/stores/nav';

	let {
		libraryCount,
		activityCount,
		wantedCount,
		systemCount,
		diskSummary,
		diskPct
	}: {
		libraryCount: number;
		activityCount: number;
		wantedCount: number;
		systemCount: number;
		diskSummary: string;
		diskPct: string;
	} = $props();

	const badges = $derived<Record<string, number>>({
		library: libraryCount,
		activity: activityCount,
		wanted: wantedCount,
		system: systemCount
	});

	const active = $derived(activeNavKey(page.url.pathname));
	const expanded = $derived(store.sidebarExpanded);
</script>

<aside
	style="width:var(--sidebar);flex:none;border-right:1px solid var(--bd);position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow:hidden;transition:width 140ms ease-out"
>
	<div
		style="height:56px;flex:none;display:flex;align-items:center;gap:9px;padding:0 16px;border-bottom:1px solid var(--bd)"
	>
		<div
			style="width:22px;height:22px;flex:none;border-radius:6px;background:var(--inv);color:var(--invfg);display:grid;place-items:center;font-weight:600;font-size:13px;letter-spacing:-.04em"
		>
			A
		</div>
		{#if expanded}
			<span style="font-weight:600;font-size:14px;letter-spacing:-.02em">Atlas</span>
		{/if}
	</div>

	<nav
		style="flex:1;display:flex;flex-direction:column;gap:2px;padding:12px 8px;overflow-y:auto;overflow-x:hidden"
	>
		{#each NAV_ITEMS as item (item.key)}
			{@const isActive = active === item.key}
			{@const badge = item.badge ? badges[item.badge] : undefined}
			<a
				href={item.href}
				title={item.label}
				class="at-hov"
				style="display:flex;align-items:center;gap:10px;width:100%;padding:7px 8px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;transition:background 120ms ease-out,color 120ms ease-out;background:{isActive
					? 'var(--hover)'
					: 'transparent'};color:{isActive ? 'var(--text)' : 'var(--sec)'}"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.7"
					stroke-linecap="round"
					stroke-linejoin="round"
					style="flex:none"
				>
					{#each item.paths as d}
						<path {d} />
					{/each}
				</svg>
				{#if expanded}
					<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
						>{item.label}</span
					>
				{/if}
				{#if badge}
					<span
						style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;padding:1px 5px;border-radius:4px;background:transparent;color:var(--muted)"
						>{badge}</span
					>
				{/if}
			</a>
		{/each}
	</nav>

	{#if expanded}
		<div
			style="flex:none;padding:12px 16px;border-top:1px solid var(--bd);display:flex;flex-direction:column;gap:7px"
		>
			<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)">
				<span>Disk</span>
				<span style="font-family:'Geist Mono',ui-monospace,monospace">{diskSummary}</span>
			</div>
			<div style="height:4px;border-radius:6px;background:var(--bd);overflow:hidden">
				<div style="height:100%;border-radius:6px;background:var(--sec);width:{diskPct}"></div>
			</div>
			<div
				style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
			>
				Atlas · Sonarr + Radarr
			</div>
		</div>
	{/if}
</aside>
