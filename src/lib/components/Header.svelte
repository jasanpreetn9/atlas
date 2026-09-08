<script lang="ts">
	import { store } from '$lib/stores/store.svelte';

	let { systemCount = 0 }: { systemCount?: number } = $props();

	const SUN = [
		'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
		'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19'
	];
	const MOON = ['M21 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z'];
	const themePaths = $derived(store.theme === 'dark' ? MOON : SUN);
</script>

<header
	style="position:sticky;top:0;z-index:40;flex:none;height:56px;display:flex;align-items:center;gap:10px;padding:0 20px;background:var(--bg);border-bottom:1px solid var(--bd)"
>
	<button
		type="button"
		onclick={() => store.toggleSidebar()}
		title="Toggle sidebar"
		class="at-hov"
		style="display:grid;place-items:center;width:28px;height:28px;flex:none;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--sec);cursor:pointer;transition:background 120ms ease-out"
	>
		<svg
			width="15"
			height="15"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
		>
			<path d="M3 5h18M3 12h18M3 19h18" />
		</svg>
	</button>

	<div style="position:relative;flex:1;max-width:400px;min-width:120px">
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--muted)"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m16.4 16.4 4.6 4.6" />
		</svg>
		<input
			type="text"
			placeholder="Search library…  ⌘K"
			value={store.query}
			oninput={(e) => (store.query = e.currentTarget.value)}
			class="at-focus"
			style="width:100%;height:32px;padding:0 10px 0 29px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--text);font-size:13px;outline:none;transition:border-color 120ms ease-out,box-shadow 120ms ease-out"
		/>
	</div>

	<div style="flex:1"></div>

	<a
		href="/add"
		class="at-op"
		style="display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:6px;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:opacity 120ms ease-out"
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M12 5v14M5 12h14" />
		</svg>Add
	</a>

	<a
		href="/system"
		title="Health warnings"
		class="at-bdh-t"
		style="position:relative;display:grid;place-items:center;width:32px;height:32px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--sec);cursor:pointer;text-decoration:none;transition:border-color 120ms ease-out"
	>
		<svg
			width="15"
			height="15"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
		>
			<path d="M18 9a6 6 0 1 0-12 0c0 5-2 7-2 7h16s-2-2-2-7" />
			<path d="M10.5 20a2 2 0 0 0 3 0" />
		</svg>
		{#if systemCount > 0}
			<span
				style="position:absolute;top:5px;right:6px;width:6px;height:6px;border-radius:50%;background:var(--warn)"
			></span>
		{/if}
	</a>

	<button
		type="button"
		onclick={() => store.toggleTheme()}
		title="Toggle theme"
		class="at-bdh-t"
		style="display:grid;place-items:center;width:32px;height:32px;border-radius:6px;border:1px solid var(--bd);background:var(--surf);color:var(--sec);cursor:pointer;transition:border-color 120ms ease-out"
	>
		<svg
			width="15"
			height="15"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
		>
			{#each themePaths as d}
				<path {d} />
			{/each}
		</svg>
	</button>

	<button
		type="button"
		class="at-bdh"
		style="width:28px;height:28px;flex:none;border-radius:50%;border:1px solid var(--bd);background:var(--surf);color:var(--sec);font-size:11px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
		>JD</button
	>
</header>
