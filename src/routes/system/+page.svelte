<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/api/client';
	import type { WantedKind } from '$lib/api/client';
	import { store } from '$lib/stores/store.svelte';
	import {
		backupRows,
		healthRows,
		logRows,
		statusRows,
		taskRows,
		updateRows,
		type SysRow
	} from '$lib/view/system';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'status' | 'health' | 'tasks' | 'updates' | 'backups' | 'logs';
	let tab = $state<Tab>('status');
	let now = $state(new Date());

	onMount(() => {
		const t = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(t);
	});

	const apps = $derived((['sonarr', 'radarr'] as const).filter((k) => data.ping[k].configured));
	const appLabel: Record<string, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };

	interface Section {
		key: string;
		title: string;
		note: string;
		rows: SysRow[];
		empty: string;
	}

	const sections = $derived.by<Section[]>(() => {
		if (tab === 'health') {
			return [
				{
					key: 'health',
					title: 'Health checks',
					note: '',
					rows: healthRows(data.health),
					empty: 'All checks passing.'
				}
			];
		}
		return apps.map((k) => {
			const label = appLabel[k];
			if (tab === 'status') {
				const sys = data.status[k];
				return {
					key: k,
					title: label,
					note: sys?.version ?? (data.ping[k].reachable ? '' : 'unreachable'),
					rows: sys ? statusRows(sys, now) : [],
					empty: `Couldn't reach ${label}.`
				};
			}
			if (tab === 'tasks') {
				return {
					key: k,
					title: label,
					note: `${data.tasks[k].length} scheduled`,
					rows: taskRows(data.tasks[k], now),
					empty: 'No scheduled tasks.'
				};
			}
			if (tab === 'updates') {
				return {
					key: k,
					title: label,
					note: '',
					rows: updateRows(data.updates[k], now),
					empty: 'No update history.'
				};
			}
			if (tab === 'backups') {
				return {
					key: k,
					title: label,
					note: `${data.backups[k].length} backup${data.backups[k].length === 1 ? '' : 's'}`,
					rows: backupRows(data.backups[k], now),
					empty: 'No backups yet.'
				};
			}
			return {
				key: k,
				title: label,
				note: '',
				rows: logRows(data.logs[k], now),
				empty: 'No log files.'
			};
		});
	});

	const TABS: { key: Tab; label: string }[] = [
		{ key: 'status', label: 'Status' },
		{ key: 'health', label: 'Health' },
		{ key: 'tasks', label: 'Tasks' },
		{ key: 'updates', label: 'Updates' },
		{ key: 'backups', label: 'Backups' },
		{ key: 'logs', label: 'Log Files' }
	];

	const healthCount = $derived(data.health.filter((h) => h.type !== 'ok').length);

	function notYet(label: string) {
		store.toast(`${label} isn't wired up yet`, 'var(--neutral)');
	}

	function appNames() {
		return apps.map((k) => appLabel[k]).join(' and ');
	}

	/** The page groups by 'sonarr' | 'radarr' for display; the API calls want 'series' | 'movie'. */
	function kindOf(app: 'sonarr' | 'radarr'): WantedKind {
		return app === 'sonarr' ? 'series' : 'movie';
	}

	function restart() {
		if (apps.length === 0) return;
		store.openConfirm({
			title: 'Restart?',
			body: `Restart ${appNames()}. Each comes back up on its own after a few seconds; the page may show stale data until then.`,
			confirmLabel: 'Restart',
			danger: true,
			onConfirm: async () => {
				// A restarting app can drop the connection before answering, so a request
				// failing here isn't necessarily a failure - don't second-guess it.
				await Promise.all(apps.map((k) => api.restartApp(kindOf(k)).catch(() => {})));
				store.toast(`Restarting ${appNames()}…`, 'var(--warn)');
			}
		});
	}

	function shutdown() {
		if (apps.length === 0) return;
		store.openConfirm({
			title: 'Shut down?',
			body: `Shut down ${appNames()}. Unlike Restart, nothing brings it back up on its own unless something else (a service manager, Docker) does.`,
			confirmLabel: 'Shutdown',
			danger: true,
			onConfirm: async () => {
				await Promise.all(apps.map((k) => api.shutdownApp(kindOf(k)).catch(() => {})));
				store.toast(`Shutting down ${appNames()}…`, 'var(--err)');
			}
		});
	}

	async function copyInfo() {
		const lines: string[] = [];
		for (const k of ['sonarr', 'radarr'] as const) {
			const sys = data.status[k];
			const p = data.ping[k];
			lines.push(
				`${appLabel[k]}: ${p.configured ? (p.reachable ? 'reachable' : 'unreachable') : 'not configured'}` +
					(sys
						? ` · v${sys.version} · ${sys.branch} · ${sys.runtimeName} ${sys.runtimeVersion}`
						: '')
			);
		}
		lines.push(`Health: ${healthCount} warning${healthCount === 1 ? '' : 's'}`);
		try {
			await navigator.clipboard.writeText(lines.join('\n'));
			store.toast('System info copied', 'var(--ok)');
		} catch {
			store.toast('Clipboard unavailable', 'var(--err)');
		}
	}
</script>

<div
	style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap"
>
	<h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:-.02em">System</h1>
	<div style="display:flex;gap:8px;flex-wrap:wrap">
		<button
			type="button"
			onclick={() => {
				invalidateAll();
				store.toast('Reloading system info', 'var(--accent)');
			}}
			class="at-bdh"
			style="height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
			>Refresh</button
		>
		<button
			type="button"
			onclick={copyInfo}
			class="at-bdh"
			style="height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
			>Copy info</button
		>
		<button
			type="button"
			onclick={restart}
			disabled={apps.length === 0}
			class="at-bdh"
			style="height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--warn);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out;opacity:{apps.length ===
			0
				? '.5'
				: '1'}">Restart</button
		>
		<button
			type="button"
			onclick={shutdown}
			disabled={apps.length === 0}
			class="at-bdh"
			style="height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--err);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out;opacity:{apps.length ===
			0
				? '.5'
				: '1'}">Shutdown</button
		>
	</div>
</div>

<div
	style="display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:16px;overflow-x:auto"
>
	{#each TABS as t (t.key)}
		<button
			type="button"
			onclick={() => (tab = t.key)}
			class="at-ct"
			style="padding:9px 12px;border:none;background:transparent;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;border-bottom:2px solid {tab ===
			t.key
				? 'var(--text)'
				: 'transparent'};margin-bottom:-1px;color:{tab === t.key ? 'var(--text)' : 'var(--muted)'}"
			>{t.label}{#if t.key === 'health' && healthCount > 0}<span
					style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--warn);margin-left:6px"
					>{healthCount}</span
				>{/if}</button
		>
	{/each}
</div>

{#if apps.length === 0}
	<div
		style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);padding:24px;text-align:center;font-size:13px;color:var(--muted)"
	>
		No app configured. Set `SONARR_URL` / `RADARR_URL` in `.env`.
	</div>
{:else}
	<div style="display:flex;flex-direction:column;gap:14px">
		{#each sections as sec (sec.key)}
			<section
				style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
			>
				<div
					style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--bd)"
				>
					<h2 style="margin:0;font-size:14px;font-weight:600">{sec.title}</h2>
					{#if sec.note}
						<span
							style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
							>{sec.note}</span
						>
					{/if}
				</div>
				{#each sec.rows as r (r.key)}
					<div
						class="at-hov-bg"
						style="display:flex;align-items:center;gap:14px;padding:var(--rowpad);border-bottom:1px solid var(--bd);transition:background 120ms ease-out"
					>
						{#if r.dot}
							<span style="flex:none;width:7px;height:7px;border-radius:50%;background:{r.dot}"
							></span>
						{/if}
						<span
							style="flex:none;width:190px;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
							>{r.a}</span
						>
						<span
							style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
							>{r.b}</span
						>
						<span
							style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted);white-space:nowrap"
							>{r.c}</span
						>
						{#if r.href}
							<a
								href={r.href}
								target="_blank"
								rel="noreferrer"
								class="at-bdh"
								style="flex:none;height:26px;display:grid;place-items:center;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;text-decoration:none;transition:border-color 120ms ease-out"
								>Wiki</a
							>
						{/if}
					</div>
				{/each}
				{#if sec.rows.length === 0}
					<div style="padding:16px;font-size:13px;color:var(--muted)">{sec.empty}</div>
				{/if}
			</section>
		{/each}
	</div>
{/if}
