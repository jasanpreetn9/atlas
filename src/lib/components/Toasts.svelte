<script lang="ts">
	import { store } from '$lib/stores/store.svelte';
</script>

<div
	style="position:fixed;bottom:20px;right:20px;z-index:120;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none"
>
	{#each store.toasts as t (t.id)}
		<div
			style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--bd);border-radius:8px;background:var(--raised);font-size:13px;animation:tin 140ms ease-out;box-shadow:0 8px 30px rgba(0,0,0,.4)"
		>
			<span style="width:6px;height:6px;border-radius:50%;background:{t.color}"></span>{t.msg}
		</div>
	{/each}
</div>
