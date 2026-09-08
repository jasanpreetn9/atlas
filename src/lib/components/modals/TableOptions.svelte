<script lang="ts">
	import { store, EP_COLUMNS } from '$lib/stores/store.svelte';

	function close() {
		store.epColsOpen = false;
	}
</script>

{#if store.epColsOpen}
	<div
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="presentation"
		style="position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(e) => e.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:420px;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div style="padding:16px 18px;border-bottom:1px solid var(--bd)">
				<h2 style="margin:0;font-size:15px;font-weight:600;letter-spacing:-.01em">Table Options</h2>
				<div style="font-size:12px;color:var(--sec);margin-top:2px">
					Choose which columns are visible
				</div>
			</div>
			<div
				style="padding:12px 18px;display:flex;flex-direction:column;gap:2px;max-height:52vh;overflow-y:auto"
			>
				{#each EP_COLUMNS as c (c.key)}
					{@const on = !!store.epShow[c.key]}
					<button
						type="button"
						onclick={() => store.toggleEpColumn(c.key)}
						disabled={c.locked}
						class="at-hov-bg"
						style="display:flex;align-items:center;gap:10px;padding:8px 4px;border:none;background:transparent;color:var(--text);font-size:13px;text-align:left;cursor:pointer;opacity:{c.locked
							? '.5'
							: '1'}"
					>
						<span
							style="flex:none;width:16px;height:16px;border-radius:4px;border:1px solid {on
								? 'var(--accent)'
								: 'var(--bd)'};background:{on
								? 'var(--accent)'
								: 'transparent'};color:#fff;font-size:11px;display:grid;place-items:center"
							>{on ? '✓' : ''}</span
						>{c.label}
					</button>
				{/each}
			</div>
			<div
				style="display:flex;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--bd)"
			>
				<button
					type="button"
					onclick={close}
					class="at-op"
					style="height:34px;padding:0 13px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer"
					>Close</button
				>
			</div>
		</div>
	</div>
{/if}
