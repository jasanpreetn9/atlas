<script lang="ts">
	// Generic confirm-before-you-act modal. Any screen can trigger it with
	// `store.openConfirm({ title, body, onConfirm })`; it stays open (with a
	// "Working…" button) until `onConfirm` resolves, then closes itself.

	import { store } from '$lib/stores/store.svelte';

	const spec = $derived(store.confirmSpec);

	function cancel() {
		if (store.confirmBusy) return;
		store.closeConfirm();
	}
</script>

{#if spec}
	<div
		onclick={cancel}
		onkeydown={(ev) => ev.key === 'Escape' && cancel()}
		role="presentation"
		style="position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(ev) => ev.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:420px;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);padding:20px"
		>
			<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;letter-spacing:-.01em">
				{spec.title}
			</h2>
			<p style="margin:0;font-size:13px;color:var(--sec);line-height:1.55">{spec.body}</p>
			<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">
				<button
					type="button"
					onclick={cancel}
					disabled={store.confirmBusy}
					style="height:32px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer"
					>Cancel</button
				>
				<button
					type="button"
					onclick={() => store.runConfirm()}
					disabled={store.confirmBusy}
					class="at-op"
					style="height:32px;padding:0 14px;border-radius:6px;border:none;background:{spec.danger
						? 'var(--err)'
						: 'var(--inv)'};color:{spec.danger
						? '#fff'
						: 'var(--invfg)'};font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;opacity:{store.confirmBusy
						? '.6'
						: '1'}">{store.confirmBusy ? 'Working…' : (spec.confirmLabel ?? 'Confirm')}</button
				>
			</div>
		</div>
	</div>
{/if}
