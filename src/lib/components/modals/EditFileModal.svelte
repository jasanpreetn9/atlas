<script lang="ts">
	// Corrects a file's recorded quality and language(s) without touching the
	// file on disk. Opened from the movie file card.

	import { api } from '$lib/api/client';
	import type { Language, QualityDefinitionResource } from '$lib/api/common';
	import { library } from '$lib/stores/library.svelte';
	import { store } from '$lib/stores/store.svelte';

	const target = $derived(store.editFileTarget);

	let loading = $state(false);
	let saving = $state(false);
	let qualities = $state<QualityDefinitionResource[]>([]);
	let languages = $state<Language[]>([]);
	let qualityId = $state<number | null>(null);
	let languageIds = $state<Set<number>>(new Set());
	let loadedFor: string | null = null;

	$effect(() => {
		const t = target;
		if (!t) {
			loadedFor = null;
			return;
		}
		const key = `${t.kind}:${t.file.id}`;
		if (loadedFor === key) return;
		loadedFor = key;
		qualityId = t.file.quality?.quality?.id ?? null;
		languageIds = new Set(t.file.languages?.map((l) => l.id) ?? []);
		loading = true;
		Promise.all([api.getQualityDefinitions(t.kind), api.getLanguages(t.kind)])
			.then(([q, l]) => {
				qualities = q;
				languages = l;
			})
			.catch(() => {
				qualities = [];
				languages = [];
			})
			.finally(() => (loading = false));
	});

	function toggleLanguage(id: number) {
		const next = new Set(languageIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		languageIds = next;
	}

	function close() {
		if (saving) return;
		store.closeEditFile();
	}

	async function save() {
		const t = target;
		if (!t || qualityId == null || saving) return;
		const quality = qualities.find((q) => q.quality.id === qualityId)?.quality;
		if (!quality) return;
		const chosenLanguages = languages.filter((l) => languageIds.has(l.id));
		saving = true;
		try {
			if (t.kind === 'series') {
				await api.editEpisodeFile({
					...t.file,
					quality: { ...t.file.quality, quality },
					languages: chosenLanguages
				});
			} else {
				await api.editMovieFile({
					...t.file,
					quality: { ...t.file.quality, quality },
					languages: chosenLanguages
				});
			}
			await library.refresh();
			store.toast(`Updated ${t.title}`, 'var(--ok)');
			store.closeEditFile();
		} catch {
			store.toast('Could not update the file', 'var(--err)');
		} finally {
			saving = false;
		}
	}
</script>

{#if target}
	<div
		onclick={close}
		onkeydown={(ev) => ev.key === 'Escape' && close()}
		role="presentation"
		style="position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(ev) => ev.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:460px;max-height:100%;display:flex;flex-direction:column;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--bd)"
			>
				<h2
					style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;letter-spacing:-.01em"
				>
					Edit File - {target.title}
				</h2>
				<button
					type="button"
					onclick={close}
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

			<div style="flex:1;overflow:auto;padding:18px">
				{#if target.subtitle}
					<p style="margin:0 0 14px;font-size:12px;color:var(--muted)">{target.subtitle}</p>
				{/if}

				{#if loading}
					<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
						Loading…
					</div>
				{:else}
					<label
						for="edit-file-quality"
						style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px"
						>Quality</label
					>
					<select
						id="edit-file-quality"
						bind:value={qualityId}
						style="width:100%;height:34px;padding:0 10px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--text);font-size:13px;cursor:pointer;outline:none;margin-bottom:16px"
					>
						{#each qualities as q (q.quality.id)}
							<option value={q.quality.id}>{q.title ?? q.quality.name}</option>
						{/each}
					</select>

					<span
						style="display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px"
						>Languages</span
					>
					<div style="display:flex;flex-wrap:wrap;gap:6px">
						{#each languages as l (l.id)}
							{@const on = languageIds.has(l.id)}
							<button
								type="button"
								onclick={() => toggleLanguage(l.id)}
								style="height:28px;padding:0 10px;border-radius:6px;border:1px solid {on
									? 'var(--accent)'
									: 'var(--bd)'};background:{on ? 'var(--sel)' : 'transparent'};color:{on
									? 'var(--text)'
									: 'var(--sec)'};font-size:12px;font-weight:500;cursor:pointer">{l.name}</button
							>
						{/each}
					</div>
				{/if}
			</div>

			<div
				style="display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid var(--bd)"
			>
				<button
					type="button"
					onclick={close}
					disabled={saving}
					style="height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer"
					>Cancel</button
				>
				<button
					type="button"
					onclick={save}
					disabled={loading || saving || qualityId == null}
					class="at-op"
					style="height:34px;padding:0 14px;border-radius:6px;border:none;background:var(--inv);color:var(--invfg);font-size:13px;font-weight:500;cursor:pointer;transition:opacity 120ms ease-out;opacity:{loading ||
					saving ||
					qualityId == null
						? '.5'
						: '1'}">{saving ? 'Saving…' : 'Save'}</button
				>
			</div>
		</div>
	</div>
{/if}
