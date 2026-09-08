<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';
	import type { QueueItem } from '$lib/api/client';
	import { store } from '$lib/stores/store.svelte';
	import { formatBytes, daysUntil, relativeAge, splitBytes, timeLabel } from '$lib/view/format';
	import {
		deriveEpisodeStatus,
		deriveMovieStatus,
		deriveSeriesStatus,
		STATUS_BADGE_BG,
		STATUS_COLOR,
		STATUS_LABEL
	} from '$lib/view/status';
	import { movieToMediaItem, queueIndex, seriesToMediaItem } from '$lib/view/media';
	import { groupGrabs, queueRow } from '$lib/view/activity';
	import { rootFolderDisks } from '$lib/view/disk';
	import { failureRows, missingRows, type SearchCommand } from '$lib/view/wanted';
	import { library } from '$lib/stores/library.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// `now` ticks so relative times stay fresh.
	let now = $state(new Date());
	const nowLabel = $derived(
		`${DOW[now.getDay()]} ${now.getDate()} ${MON[now.getMonth()]} ${now.getFullYear()}`
	);
	const startOfToday = $derived(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

	// Live queue poll (every 30s) supersedes the load-time snapshot.
	let liveQueue = $state<QueueItem[] | null>(null);
	const queue = $derived(liveQueue ?? library.queue);

	onMount(() => {
		const tick = setInterval(() => (now = new Date()), 30_000);
		const poll = setInterval(async () => {
			try {
				liveQueue = await api.getQueue();
			} catch {
				/* keep last snapshot */
			}
		}, 30_000);
		return () => {
			clearInterval(tick);
			clearInterval(poll);
		};
	});

	const loadFailed = (key: string) => data.loadErrors.includes(key);

	const seriesById = $derived(new Map(library.series.map((s) => [s.id, s])));
	const moviesById = $derived(new Map(library.movies.map((m) => [m.id, m])));
	const qIndex = $derived(queueIndex([...store.extraQueue, ...queue]));

	// ---- stat cards ----
	const movieBytes = $derived(
		library.movies.reduce((n, m) => n + (m.statistics?.sizeOnDisk ?? m.sizeOnDisk ?? 0), 0)
	);
	const seriesBytes = $derived(
		library.series.reduce((n, s) => n + (s.statistics?.sizeOnDisk ?? 0), 0)
	);
	const seriesEpisodes = $derived(
		library.series.reduce((n, s) => n + (s.statistics?.totalEpisodeCount ?? 0), 0)
	);
	// "Missing" = derived from the loaded library, same definition as the Library screen.
	const wantedTotal = $derived(
		library.series.filter((s) => deriveSeriesStatus(s, qIndex.series.has(s.id)) === 'missing')
			.length +
			library.movies.filter((m) => deriveMovieStatus(m, qIndex.movie.has(m.id)) === 'missing')
				.length
	);
	const librarySize = $derived(splitBytes(movieBytes + seriesBytes));

	const stats = $derived([
		{ label: 'Movies', value: String(library.movies.length), sub: formatBytes(movieBytes) },
		{ label: 'Series', value: String(library.series.length), sub: `${seriesEpisodes} episodes` },
		{ label: 'Library size', value: librarySize[0], sub: `${librarySize[1]} on disk` },
		{ label: 'Wanted', value: String(wantedTotal), sub: 'missing · monitored' }
	]);

	// ---- needs attention ----
	async function runSearch(cmd: SearchCommand, label: string) {
		store.toast(`Searching · ${label}`, 'var(--accent)');
		try {
			await api.sendCommand(cmd.app, cmd.body);
		} catch {
			store.toast(`Search failed · ${label}`, 'var(--err)');
		}
	}

	const attnMissing = $derived(
		[
			...missingRows(data.wantedSeries.records, 'series', seriesById, now),
			...missingRows(data.wantedMovies.records, 'movie', seriesById, now)
		].slice(0, 6)
	);
	const attnFailures = $derived(failureRows(data.history, seriesById, moviesById, now).slice(0, 5));
	const attnMissingMore = $derived(
		Math.max(
			0,
			data.wantedSeries.totalRecords + data.wantedMovies.totalRecords - attnMissing.length
		)
	);
	const hasAttention = $derived(attnMissing.length > 0 || attnFailures.length > 0);

	// ---- upcoming (next 7 airing, from calendar) ----
	interface Up {
		id: string;
		kind: 'series' | 'movie';
		when: Date;
		title: string;
		code: string;
		ep: string;
		status: ReturnType<typeof deriveEpisodeStatus>;
		href: string;
	}

	const upcomingRaw = $derived.by<Up[]>(() => {
		const out: Up[] = [];
		for (const item of data.calendar) {
			if (item.kind === 'series') {
				if (!item.airDateUtc) continue;
				const s = item.series ?? seriesById.get(item.seriesId);
				out.push({
					id: `s:${item.seriesId}`,
					kind: 'series',
					when: new Date(item.airDateUtc),
					title: s?.title ?? 'Unknown series',
					code: `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')}`,
					ep: item.title ?? '',
					status: deriveEpisodeStatus(item, qIndex.series.has(item.seriesId)),
					href: `/library/s:${item.seriesId}`
				});
			} else {
				const d = item.digitalRelease ?? item.physicalRelease ?? item.inCinemas;
				if (!d) continue;
				out.push({
					id: `m:${item.id}`,
					kind: 'movie',
					when: new Date(d),
					title: item.title ?? 'Unknown movie',
					code: String(item.year),
					ep: '',
					status: deriveMovieStatus(item, qIndex.movie.has(item.id)),
					href: `/library/m:${item.id}`
				});
			}
		}
		return out
			.filter((u) => u.when.getTime() >= startOfToday.getTime())
			.sort((a, b) => a.when.getTime() - b.when.getTime());
	});

	const upcoming = $derived(
		upcomingRaw.slice(0, 7).map((u) => {
			const dd = daysUntil(u.when.toISOString(), now) ?? 0;
			const time = timeLabel(u.when.toISOString());
			const when =
				dd <= 0
					? `Today ${time}`
					: dd === 1
						? `Tomorrow ${time}`
						: `${DOW[u.when.getDay()]} ${time}`;
			const today = dd <= 0;
			return {
				...u,
				tag: u.kind === 'series' ? 'TV' : 'M',
				when,
				badge: today ? STATUS_LABEL[u.status] : `Airs ${DOW[u.when.getDay()]}`,
				badgeBg: today ? STATUS_BADGE_BG[u.status] : 'transparent',
				badgeFg: today ? STATUS_COLOR[u.status] : 'var(--muted)'
			};
		})
	);

	// ---- health ----
	const healthRows = $derived(
		data.health.map((h, i) => ({
			key: `h${i}`,
			color:
				h.type === 'error' ? 'var(--err)' : h.type === 'warning' ? 'var(--warn)' : 'var(--neutral)',
			title: h.message ?? h.source ?? 'Health notice',
			detail: h.source ?? ''
		}))
	);
	const healthWarnings = $derived(data.health.filter((h) => h.type !== 'ok').length);
	const healthCount = $derived(`${healthWarnings} warning${healthWarnings === 1 ? '' : 's'}`);

	// ---- downloading ----
	const queueShort = $derived([...store.extraQueue, ...queue].slice(0, 4).map(queueRow));

	// ---- recently added ----
	const mediaItems = $derived([
		...library.series.map((s) =>
			seriesToMediaItem(s, library.profileNames, qIndex.series.has(s.id))
		),
		...library.movies.map((m) => movieToMediaItem(m, library.profileNames, qIndex.movie.has(m.id)))
	]);
	const recent = $derived(
		[...mediaItems]
			.sort((a, b) => Date.parse(b.added) - Date.parse(a.added))
			.slice(0, 12)
			.map((it) => ({
				key: it.id,
				href: `/library/${it.id}`,
				tag: it.kind === 'series' ? 'TV' : 'M',
				dot: STATUS_COLOR[it.status],
				title: it.title,
				year: String(it.year),
				ago: relativeAge(it.added, now),
				poster: it.poster
			}))
	);

	// ---- disk usage (root folders only) ----
	const disks = $derived(rootFolderDisks(library.rootFolders, library.diskSpace));

	// ---- recent grabs (grouped by show + event) ----
	const grabsGrouped = $derived(
		groupGrabs(
			[...data.history].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
			seriesById,
			moviesById,
			now
		).slice(0, 6)
	);

	function refreshAll() {
		store.toast('Refreshing all monitored titles', 'var(--accent)');
		api.sendCommand('series', { name: 'RefreshSeries' }).catch(() => {});
		api.sendCommand('movie', { name: 'RefreshMovie' }).catch(() => {});
	}
</script>

<div
	style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px"
>
	<div>
		<h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:-.02em">Dashboard</h1>
		<p style="margin:3px 0 0;font-size:13px;color:var(--sec)">
			Movies and TV, combined · {nowLabel}
		</p>
	</div>
	<div style="display:flex;gap:8px">
		<button
			type="button"
			onclick={refreshAll}
			class="at-bdh"
			style="height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
			>Refresh all</button
		>
		<a
			href="/activity"
			class="at-bdh"
			style="display:grid;place-items:center;height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:13px;font-weight:500;text-decoration:none;transition:border-color 120ms ease-out"
			>Open queue</a
		>
	</div>
</div>

<div
	style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px"
>
	{#each stats as s (s.label)}
		<div
			class="at-bdh"
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);padding:14px 16px;transition:border-color 120ms ease-out"
		>
			<div style="font-size:12px;color:var(--muted);font-weight:500">{s.label}</div>
			<div style="display:flex;align-items:baseline;gap:7px;margin-top:5px">
				<span
					style="font-family:'Geist Mono',ui-monospace,monospace;font-size:24px;font-weight:500;letter-spacing:-.03em"
					>{s.value}</span
				>
				<span style="font-size:12px;color:var(--sec)">{s.sub}</span>
			</div>
		</div>
	{/each}
</div>

{#if hasAttention}
	<section
		style="border:1px solid rgba(245,166,35,.35);border-radius:8px;background:var(--surf);margin-bottom:16px;overflow:hidden"
	>
		<div
			style="display:flex;align-items:center;gap:9px;padding:13px 16px;border-bottom:1px solid var(--bd);background:rgba(245,166,35,.06)"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--warn)"
				stroke-width="1.8"
				style="flex:none"
			>
				<path d="M12 4.5 21 19H3z" /><path d="M12 10v4" /><path d="M12 16.6h.01" />
			</svg>
			<h2 style="margin:0;font-size:14px;font-weight:600">Needs attention</h2>
			<span
				style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
				>{attnMissing.length + attnFailures.length}</span
			>
		</div>

		{#each attnFailures as f (f.key)}
			<div
				style="display:flex;align-items:center;gap:10px;padding:var(--rowpad);border-bottom:1px solid var(--bd)"
			>
				<span style="flex:none;width:6px;height:6px;border-radius:50%;background:var(--err)"></span>
				<span
					style="flex:none;width:20px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;border:1px solid var(--bd);border-radius:4px;color:var(--muted)"
					>{f.tag}</span
				>
				<a
					href={f.href || undefined}
					style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;text-decoration:none;color:inherit"
					>{f.title}</a
				>
				<span
					style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
					>{f.code}</span
				>
				<span style="flex:none;font-size:12px;color:var(--err)">grab failed</span>
				<span
					style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
					>{f.whenLabel}</span
				>
				<button
					type="button"
					onclick={() => runSearch(f.search, `${f.title} ${f.code}`.trim())}
					class="at-bdh"
					style="flex:none;height:26px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
					>Retry</button
				>
			</div>
		{/each}

		{#each attnMissing as m (m.key)}
			<div
				style="display:flex;align-items:center;gap:10px;padding:var(--rowpad);border-bottom:1px solid var(--bd)"
			>
				<span style="flex:none;width:6px;height:6px;border-radius:50%;background:var(--warn)"
				></span>
				<span
					style="flex:none;width:20px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;border:1px solid var(--bd);border-radius:4px;color:var(--muted)"
					>{m.tag}</span
				>
				<a
					href={m.href || undefined}
					style="flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;text-decoration:none;color:inherit"
					>{m.title}</a
				>
				<span
					style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
					>{m.code}</span
				>
				<span
					style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--muted)"
					>{m.sub}</span
				>
				<span style="flex:none;font-size:11px;color:var(--muted)">{m.whenLabel}</span>
				<button
					type="button"
					onclick={() => runSearch(m.search, `${m.title} ${m.code}`.trim())}
					class="at-bdh"
					style="flex:none;height:26px;padding:0 9px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out"
					>Search</button
				>
			</div>
		{/each}

		{#if attnMissingMore > 0}
			<a
				href="/wanted"
				class="at-hov-bg"
				style="display:block;padding:11px 16px;font-size:12px;color:var(--sec);text-decoration:none"
				>+{attnMissingMore} more missing →</a
			>
		{/if}
	</section>
{/if}

<section
	style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);margin-bottom:16px;overflow:hidden"
>
	<div
		style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bd)"
	>
		<h2 style="margin:0;font-size:14px;font-weight:600">Recently added</h2>
		<a
			href="/library"
			class="at-hov"
			style="padding:3px 8px;border-radius:6px;background:transparent;color:var(--sec);font-size:12px;font-weight:500;text-decoration:none"
			>Library →</a
		>
	</div>
	<div style="display:flex;gap:12px;padding:16px;overflow-x:auto">
		{#each recent as r (r.key)}
			<a
				href={r.href}
				class="at-bdh"
				style="flex:none;width:132px;text-align:left;border:1px solid var(--bd);border-radius:8px;background:var(--bg);overflow:hidden;text-decoration:none;color:inherit;transition:border-color 120ms ease-out"
			>
				<div style="position:relative;height:176px;border-bottom:1px solid var(--bd)">
					<Poster src={r.poster} alt={r.title} fallbackText={r.title}>
						{#snippet top({ onImage })}
							<span
								style="font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;color:{onImage
									? 'rgba(255,255,255,.85)'
									: 'var(--muted)'};text-shadow:{onImage ? '0 1px 2px rgba(0,0,0,.6)' : 'none'}"
								>{r.tag}</span
							>
							<span
								style="width:6px;height:6px;border-radius:50%;background:{r.dot};box-shadow:{onImage
									? '0 0 0 1.5px rgba(0,0,0,.35)'
									: 'none'}"
							></span>
						{/snippet}
						{#snippet bottom({ onImage })}
							<div
								style="font-size:13px;font-weight:600;letter-spacing:-.01em;line-height:1.2;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:{onImage
									? '#fff'
									: 'var(--text)'};text-shadow:{onImage ? '0 1px 3px rgba(0,0,0,.7)' : 'none'}"
							>
								{r.title}
							</div>
						{/snippet}
					</Poster>
				</div>
				<div
					style="padding:8px 12px;display:flex;justify-content:space-between;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
				>
					<span>{r.year}</span><span>{r.ago}</span>
				</div>
			</a>
		{/each}
	</div>
</section>

<div
	style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:16px;align-items:start"
>
	<section
		style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
	>
		<div
			style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bd)"
		>
			<div style="display:flex;align-items:center;gap:9px">
				<h2 style="margin:0;font-size:14px;font-weight:600;letter-spacing:-.01em">Upcoming</h2>
				<span style="font-size:12px;color:var(--muted)">next 7 airing</span>
			</div>
			<a
				href="/calendar"
				class="at-hov"
				style="padding:3px 8px;border-radius:6px;background:transparent;color:var(--sec);font-size:12px;font-weight:500;text-decoration:none;transition:background 120ms ease-out"
				>Calendar →</a
			>
		</div>
		<div>
			{#each upcoming as u (u.id + u.code)}
				<a
					href={u.href}
					class="at-hov-bg"
					style="display:flex;align-items:center;gap:12px;padding:var(--rowpad);border-bottom:1px solid var(--bd);text-decoration:none;color:inherit;transition:background 120ms ease-out"
				>
					<span
						style="flex:none;width:22px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;font-weight:500;padding:2px 0;border-radius:4px;border:1px solid var(--bd);color:var(--muted)"
						>{u.tag}</span
					>
					<span
						style="flex:none;width:98px;white-space:nowrap;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
						>{u.when}</span
					>
					<span
						style="flex:0 1 auto;min-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;font-size:13px"
						>{u.title}</span
					>
					<span
						style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
						>{u.code}</span
					>
					<span
						style="flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--muted)"
						>{u.ep}</span
					>
					<span
						style="flex:none;font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;background:{u.badgeBg};color:{u.badgeFg}"
						>{u.badge}</span
					>
				</a>
			{/each}
			{#if upcoming.length === 0}
				<div style="padding:16px;font-size:13px;color:var(--muted)">
					{loadFailed('calendar') ? "Couldn't load the calendar." : 'Nothing airing soon.'}
				</div>
			{/if}
		</div>
	</section>

	<div style="display:flex;flex-direction:column;gap:16px">
		<section
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bd)"
			>
				<h2 style="margin:0;font-size:14px;font-weight:600">Health</h2>
				<span
					style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
					>{healthCount}</span
				>
			</div>
			{#each healthRows as h (h.key)}
				<div style="display:flex;gap:10px;padding:12px 16px;border-bottom:1px solid var(--bd)">
					<span
						style="flex:none;width:7px;height:7px;margin-top:6px;border-radius:50%;background:{h.color}"
					></span>
					<div style="min-width:0">
						<div style="font-size:13px;font-weight:500">{h.title}</div>
						{#if h.detail}
							<div style="font-size:12px;color:var(--sec);margin-top:2px">{h.detail}</div>
						{/if}
					</div>
				</div>
			{/each}
			{#if healthRows.length === 0}
				<div style="padding:12px 16px;font-size:13px;color:var(--muted)">
					{loadFailed('health') ? "Couldn't load health." : 'All checks passing.'}
				</div>
			{/if}
		</section>

		<section
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bd)"
			>
				<h2 style="margin:0;font-size:14px;font-weight:600">Downloading</h2>
				<a
					href="/activity"
					class="at-hov"
					style="padding:3px 8px;border-radius:6px;background:transparent;color:var(--sec);font-size:12px;font-weight:500;text-decoration:none"
					>Queue →</a
				>
			</div>
			{#each queueShort as q (q.key)}
				<div style="padding:11px 16px;border-bottom:1px solid var(--bd)">
					<div style="display:flex;align-items:center;gap:8px">
						<span
							style="flex:none;width:20px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;border:1px solid var(--bd);border-radius:4px;color:var(--muted)"
							>{q.tag}</span
						>
						<span
							style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500"
							>{q.title}</span
						>
						<span
							style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--sec)"
							>{q.pct}</span
						>
					</div>
					<div
						style="height:4px;border-radius:6px;background:var(--bd);margin-top:8px;overflow:hidden"
					>
						<div
							style="height:100%;border-radius:6px;transition:width 150ms ease-out;background:{q.fill};width:{q.pct}"
						></div>
					</div>
					<div
						style="display:flex;justify-content:space-between;margin-top:6px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
					>
						<span>{q.size}</span><span>{q.eta}</span>
					</div>
				</div>
			{/each}
			{#if queueShort.length === 0}
				<div style="padding:12px 16px;font-size:13px;color:var(--muted)">Queue is empty.</div>
			{/if}
			<div
				style="padding:8px 16px;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);border-top:1px solid var(--bd)"
			>
				auto-refresh · 30s
			</div>
		</section>

		<section
			style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
		>
			<div
				style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bd)"
			>
				<h2 style="margin:0;font-size:14px;font-weight:600">Disk usage</h2>
				<span style="font-size:12px;color:var(--muted)">root folders</span>
			</div>
			{#each disks as d (d.key)}
				<div style="padding:13px 16px;border-bottom:1px solid var(--bd)">
					<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px">
						<span
							style="font-family:'Geist Mono',ui-monospace,monospace;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
							>{d.path}</span
						>
						<span
							style="font-family:'Geist Mono',ui-monospace,monospace;color:var(--muted);flex:none"
							>{d.label}</span
						>
					</div>
					<div
						style="height:4px;border-radius:6px;background:var(--bd);margin-top:8px;overflow:hidden"
					>
						<div style="height:100%;border-radius:6px;background:{d.fill};width:{d.pct}"></div>
					</div>
				</div>
			{/each}
			{#if disks.length === 0}
				<div style="padding:13px 16px;font-size:13px;color:var(--muted)">
					{loadFailed('rootFolders')
						? "Couldn't load root folders."
						: 'No root folders configured.'}
				</div>
			{/if}
		</section>
	</div>
</div>

<section
	style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden;margin-top:16px"
>
	<div
		style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--bd)"
	>
		<h2 style="margin:0;font-size:14px;font-weight:600">Recent grabs</h2>
		<a
			href="/activity"
			class="at-hov"
			style="padding:3px 8px;border-radius:6px;background:transparent;color:var(--sec);font-size:12px;font-weight:500;text-decoration:none"
			>History →</a
		>
	</div>
	{#each grabsGrouped as g (g.key)}
		<a
			href={g.href || undefined}
			class="at-hov-bg"
			style="display:flex;align-items:center;gap:10px;padding:var(--rowpad);border-bottom:1px solid var(--bd);text-decoration:none;color:inherit;transition:background 120ms ease-out"
		>
			<span style="flex:none;width:6px;height:6px;border-radius:50%;background:{g.color}"></span>
			<span
				style="flex:none;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px"
				>{g.title}</span
			>
			<span
				style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
				>{g.summary}</span
			>
			<span style="flex:none;font-size:12px;color:var(--muted)">{g.event}</span>
			<span
				style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--muted)"
				>{g.ago}</span
			>
		</a>
	{/each}
	{#if grabsGrouped.length === 0}
		<div style="padding:12px 16px;font-size:13px;color:var(--muted)">
			{loadFailed('history') ? "Couldn't load history." : 'No recent history.'}
		</div>
	{/if}
</section>
