<script lang="ts">
	// Full media info breakdown for one episode or movie file. Opened from the
	// Detail page's movie file card and from the episode details modal.

	import { store } from '$lib/stores/store.svelte';

	const t = $derived(store.mediaInfo);

	function close() {
		store.closeMediaInfo();
	}

	function row(label: string, value: string | number | null | undefined) {
		return { label, value: value === null || value === undefined || value === '' ? '—' : value };
	}
</script>

{#if t}
	{@const info = t.info}
	<div
		onclick={close}
		onkeydown={(ev) => ev.key === 'Escape' && close()}
		role="presentation"
		style="position:fixed;inset:0;z-index:98;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;animation:fin 120ms ease-out"
	>
		<div
			onclick={(ev) => ev.stopPropagation()}
			role="presentation"
			style="width:100%;max-width:560px;max-height:100%;display:flex;flex-direction:column;border:1px solid var(--bd);border-radius:8px;background:var(--raised);box-shadow:0 8px 30px rgba(0,0,0,.6);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--bd)"
			>
				<h2
					style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;letter-spacing:-.01em"
				>
					Media Info
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
				<p
					style="margin:0 0 4px;font-size:13px;font-weight:600;color:var(--text);overflow-wrap:break-word"
				>
					{t.title}
				</p>
				{#if t.subtitle}
					<p style="margin:0 0 14px;font-size:12px;color:var(--muted)">{t.subtitle}</p>
				{/if}

				<div
					style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec);word-break:break-all;padding:10px 12px;border:1px solid var(--bd);border-radius:6px;margin-bottom:16px"
				>
					{t.path}
				</div>

				{#each [{ title: 'General', rows: [row('Size', t.size), row('Quality', t.quality), row('Languages', t.languages), row('Release group', t.releaseGroup), row('Added', t.added)] }, { title: 'Video', rows: info ? [row('Codec', info.videoCodec), row('Resolution', info.resolution), row('Bitrate', info.videoBitrate ? `${Math.round(info.videoBitrate / 1000)} kbps` : null), row('Frame rate', info.videoFps ? `${info.videoFps} fps` : null), row('Bit depth', info.videoBitDepth ? `${info.videoBitDepth}-bit` : null), row('Dynamic range', [info.videoDynamicRange, info.videoDynamicRangeType]
											.filter(Boolean)
											.join(' ')), row('Scan type', info.scanType)] : [] }, { title: 'Audio', rows: info ? [row('Codec', info.audioCodec), row('Channels', info.audioChannels ? `${info.audioChannels}ch` : null), row('Bitrate', info.audioBitrate ? `${Math.round(info.audioBitrate / 1000)} kbps` : null), row('Streams', info.audioStreamCount), row('Languages', info.audioLanguages)] : [] }, { title: 'Subtitles', rows: info ? [row('Embedded', info.subtitles)] : [] }] as section (section.title)}
					{#if section.rows.length}
						<div style="margin-bottom:16px">
							<h3
								style="margin:0 0 8px;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em"
							>
								{section.title}
							</h3>
							<div
								style="display:grid;grid-template-columns:140px 1fr;gap:8px 12px;border:1px solid var(--bd);border-radius:6px;padding:10px 12px"
							>
								{#each section.rows as r (r.label)}
									<span style="font-size:12px;color:var(--muted)">{r.label}</span>
									<span style="font-size:12px;color:var(--sec);overflow-wrap:break-word"
										>{r.value}</span
									>
								{/each}
							</div>
						</div>
					{/if}
				{/each}

				{#if !info}
					<div
						style="padding:14px;border:1px dashed var(--bd);border-radius:8px;text-align:center;color:var(--muted);font-size:13px"
					>
						No media info reported for this file.
					</div>
				{/if}
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
