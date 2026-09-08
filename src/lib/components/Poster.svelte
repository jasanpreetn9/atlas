<script lang="ts">
	import type { Snippet } from 'svelte';

	// Fills a positioned parent (`position:relative` + an aspect ratio). Lazy-loads the
	// image, falls back to a title card if `src` is missing or the URL fails, and paints
	// a bottom scrim only when a real image is shown. `top` / `bottom` snippets receive
	// `onImage` so callers can flip text colour for legibility over the poster.

	let {
		src = null,
		alt = '',
		fallbackText = '',
		top,
		bottom
	}: {
		src?: string | null;
		alt?: string;
		fallbackText?: string;
		top?: Snippet<[{ onImage: boolean }]>;
		bottom?: Snippet<[{ onImage: boolean }]>;
	} = $props();

	let failed = $state(false);
	$effect(() => {
		// reset when the src changes (e.g. list re-sorted onto this slot)
		src;
		failed = false;
	});
	const onImage = $derived(!!src && !failed);
</script>

<div style="position:absolute;inset:0;overflow:hidden;background:var(--surf)">
	{#if onImage}
		<img
			{src}
			{alt}
			loading="lazy"
			decoding="async"
			onerror={() => (failed = true)}
			style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"
		/>
		<div
			style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 32%,rgba(0,0,0,0) 45%,rgba(0,0,0,.88) 100%)"
		></div>
	{:else}
		<div
			style="position:absolute;inset:0;padding:12px;display:flex;align-items:flex-end;font-size:12px;font-weight:600;letter-spacing:-.01em;line-height:1.2;color:var(--sec);overflow:hidden;overflow-wrap:anywhere"
		>
			{fallbackText}
		</div>
	{/if}

	{#if top}
		<div
			style="position:absolute;top:0;left:0;right:0;padding:11px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px"
		>
			{@render top({ onImage })}
		</div>
	{/if}
	{#if bottom}
		<div
			style="position:absolute;bottom:0;left:0;right:0;padding:11px;display:flex;flex-direction:column;gap:5px"
		>
			{@render bottom({ onImage })}
		</div>
	{/if}
</div>
