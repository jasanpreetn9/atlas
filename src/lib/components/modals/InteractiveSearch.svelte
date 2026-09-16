<script lang="ts">
	import { api } from '$lib/api/client';
	import type { ReleaseItem } from '$lib/api/client';
	import { store, resolveOverride } from '$lib/stores/store.svelte';
	import { formatBytes } from '$lib/view/format';

	const subject = $derived(store.srch);

	let loading = $state(false);
	let error = $state(false);
	let releases = $state<ReleaseItem[]>([]);
	let loadedFor: string | null = null;

	$effect(() => {
		const s = subject;
		if (!s) {
			loadedFor = null;
			return;
		}
		const key = JSON.stringify(s);
		if (key === loadedFor) return;
		loadedFor = key;
		load(s);
	});

	async function load(s: NonNullable<typeof subject>) {
		loading = true;
		error = false;
		releases = [];
		try {
			releases = await api.getReleases(s);
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	}

	function refresh() {
		if (subject) load(subject);
	}

	const rows = $derived.by(() => {
		const list = releases.map((r) => {
			const isTorrent = r.protocol === 'torrent';
			return {
				key: r.guid ?? `${r.indexerId}-${r.title}`,
				release: r,
				title: r.title ?? 'Unknown release',
				indexer: r.indexer ?? '—',
				age: `${r.age}d`,
				ageN: r.age,
				sizeLabel: formatBytes(r.size),
				sizeN: r.size,
				peers: isTorrent ? `${r.seeders ?? 0}/${r.leechers ?? 0}` : '—',
				quality: r.quality?.quality?.name ?? '—',
				score: `${r.customFormatScore > 0 ? '+' : ''}${r.customFormatScore}`,
				scoreN: r.customFormatScore,
				rejected: r.rejected,
				rejectReason: r.rejections?.join(', ') ?? '',
				canOverride: r.shouldOverride === true && !!subject && resolveOverride(r, subject) !== null
			};
		});
		return list.sort((a, b) => {
			if (store.srchSort === 'size') return b.sizeN - a.sizeN;
			if (store.srchSort === 'age') return a.ageN - b.ageN;
			if (store.srchSort === 'indexer') return a.indexer.localeCompare(b.indexer);
			if (store.srchSort === 'title') return a.title.localeCompare(b.title);
			return b.scoreN - a.scoreN;
		});
	});

	const SORT_COLS = [
		{ key: 'title', label: 'Release', align: 'left' },
		{ key: 'indexer', label: 'Indexer', align: 'left' },
		{ key: 'age', label: 'Age', align: 'right' },
		{ key: 'size', label: 'Size', align: 'right' }
	] as const;

	function grabState(key: string): 'idle' | 'grabbing' | 'grabbed' {
		return store.grabs[key] ?? 'idle';
	}
</script>

{#if subject}
	<div
		onclick={() => store.closeSearch()}
		onkeydown={(e) => e.key === 'Escape' && store.closeSearch()}
		role="presentation"
		style="position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(e) => e.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:1120px;max-height:100%;display:flex;flex-direction:column;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--bd)"
			>
				<div style="flex:1;min-width:0">
					<h2 style="margin:0;font-size:15px;font-weight:600;letter-spacing:-.01em">
						Interactive Search
					</h2>
					<div
						style="font-size:12px;color:var(--sec);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
					>
						{subject.label}
					</div>
				</div>
				<span
					style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
				>
					{loading ? 'searching…' : `${rows.length} releases`}
				</span>
				<button
					type="button"
					onclick={refresh}
					disabled={loading}
					class="at-bdh"
					style="height:30px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;opacity:{loading
						? '.6'
						: '1'}">Refresh</button
				>
				<button
					type="button"
					onclick={() => store.closeSearch()}
					aria-label="Close"
					class="at-bdh-t"
					style="display:grid;place-items:center;width:30px;height:30px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--sec);cursor:pointer"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="M6 6l12 12M18 6L6 18" /></svg
					>
				</button>
			</div>

			<div style="flex:1;overflow:auto;min-height:200px">
				{#if loading}
					<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px">
						Querying indexers. This can take a little while.
					</div>
				{:else if error}
					<div style="padding:40px;text-align:center;color:var(--err);font-size:13px">
						Search failed. <button
							type="button"
							onclick={refresh}
							style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;text-decoration:underline"
							>Try again</button
						>
					</div>
				{:else if rows.length === 0}
					<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px">
						No releases found.
					</div>
				{:else}
					<table style="width:100%;border-collapse:collapse;font-size:13px">
						<thead>
							<tr style="position:sticky;top:0;background:var(--raised);z-index:5">
								{#each SORT_COLS as c (c.key)}
									<th
										onclick={() => (store.srchSort = c.key)}
										style="text-align:{c.align};padding:9px 14px;border-bottom:1px solid var(--bd);font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer;color:{store.srchSort ===
										c.key
											? 'var(--text)'
											: 'var(--muted)'}">{c.label}{store.srchSort === c.key ? ' ↓' : ''}</th
									>
								{/each}
								<th
									style="text-align:right;padding:9px 14px;border-bottom:1px solid var(--bd);font-size:12px;font-weight:500;white-space:nowrap;color:var(--muted)"
									>Peers</th
								>
								<th
									style="text-align:left;padding:9px 14px;border-bottom:1px solid var(--bd);font-size:12px;font-weight:500;white-space:nowrap;color:var(--muted)"
									>Quality</th
								>
								<th
									onclick={() => (store.srchSort = 'score')}
									style="text-align:right;padding:9px 14px;border-bottom:1px solid var(--bd);font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer;color:{store.srchSort ===
									'score'
										? 'var(--text)'
										: 'var(--muted)'}">Score{store.srchSort === 'score' ? ' ↓' : ''}</th
								>
								<th style="width:180px;border-bottom:1px solid var(--bd)"></th>
							</tr>
						</thead>
						<tbody>
							{#each rows as r (r.key)}
								{@const gs = grabState(r.key)}
								<tr
									style="transition:background 120ms ease-out;background:{r.rejected
										? 'rgba(238,0,0,.03)'
										: 'transparent'}"
									class="at-hov-bg"
								>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);width:40%;max-width:0"
									>
										<div
											style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
										>
											{r.title}
										</div>
										{#if r.rejected}
											<div
												title={r.rejectReason}
												style="display:inline-flex;align-items:center;gap:5px;margin-top:5px;font-size:11px;color:var(--err);cursor:help"
											>
												<span style="width:5px;height:5px;border-radius:50%;background:var(--err)"
												></span>{r.rejectReason}
											</div>
										{/if}
									</td>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);color:var(--sec);white-space:nowrap"
										>{r.indexer}</td
									>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;color:var(--sec);text-align:right"
										>{r.age}</td
									>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;color:var(--sec);text-align:right;white-space:nowrap"
										>{r.sizeLabel}</td
									>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;color:var(--sec);text-align:right;white-space:nowrap"
										>{r.peers}</td
									>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);white-space:nowrap"
									>
										<span
											style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;border:1px solid var(--bd);color:var(--text)"
											>{r.quality}</span
										>
									</td>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);font-family:'Geist Mono',ui-monospace,monospace;text-align:right;color:{r.scoreN <
										0
											? 'var(--err)'
											: 'var(--sec)'}">{r.score}</td
									>
									<td
										style="padding:11px 14px;border-bottom:1px solid var(--bd);text-align:right;white-space:nowrap;position:sticky;right:0;background:var(--raised)"
									>
										<span style="display:inline-flex;gap:6px">
											<button
												type="button"
												onclick={() => store.grab(r.release)}
												disabled={gs !== 'idle'}
												class="at-op"
												style="display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:6px;border:none;font-size:12px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;background:{gs ===
												'grabbed'
													? 'rgba(0,202,81,.14)'
													: gs === 'grabbing'
														? 'var(--bd)'
														: 'var(--inv)'};color:{gs === 'grabbed'
													? 'var(--ok)'
													: gs === 'grabbing'
														? 'var(--sec)'
														: 'var(--invfg)'}"
											>
												{#if gs === 'grabbing'}
													<span
														style="width:10px;height:10px;border-radius:50%;border:1.5px solid currentColor;border-top-color:transparent;animation:spin 700ms linear infinite"
													></span>
												{/if}
												{gs === 'grabbed' ? 'Grabbed' : gs === 'grabbing' ? 'Grabbing' : 'Grab'}
											</button>
											{#if r.canOverride && gs === 'idle'}
												<button
													type="button"
													onclick={() => store.grab(r.release, { override: true })}
													title="Override & Grab"
													class="at-bdh-t"
													style="height:28px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--sec);font-size:12px;font-weight:500;cursor:pointer"
													>Override</button
												>
											{/if}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>
	</div>
{/if}
