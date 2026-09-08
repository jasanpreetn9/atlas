<script lang="ts">
	import { page } from '$app/state';
</script>

<div
	style="display:flex;min-height:100vh;align-items:center;justify-content:center;padding:40px;background:var(--bg);color:var(--text);font-family:Geist,Inter,system-ui,sans-serif"
>
	<div style="max-width:440px;text-align:center">
		<div
			style="font-family:'Geist Mono',ui-monospace,monospace;font-size:44px;font-weight:500;letter-spacing:-.03em;color:var(--muted)"
		>
			{page.status}
		</div>
		<h1 style="margin:8px 0 0;font-size:18px;font-weight:600;letter-spacing:-.02em">
			{page.status === 404 ? 'Page not found' : 'Something went wrong'}
		</h1>
		<p style="margin:8px 0 20px;font-size:13px;color:var(--sec);line-height:1.6">
			{page.error?.message ?? 'An unexpected error occurred.'}
		</p>
		<div style="display:flex;gap:8px;justify-content:center">
			<a
				href="/"
				style="height:34px;display:inline-flex;align-items:center;padding:0 14px;border-radius:6px;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;text-decoration:none"
				>Go to Dashboard</a
			>
			<button
				type="button"
				onclick={() => location.reload()}
				class="at-bdh"
				style="height:34px;padding:0 14px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
				>Reload</button
			>
		</div>
	</div>
</div>
