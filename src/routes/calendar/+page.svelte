<script lang="ts">
	import { goto } from '$app/navigation';
	import { library } from '$lib/stores/library.svelte';
	import { store } from '$lib/stores/store.svelte';
	import { queueIndex } from '$lib/view/media';
	import { calendarEvents, dayKey, type CalEvent } from '$lib/view/calendar';
	import { STATUS_BADGE_BG, STATUS_COLOR, STATUS_LABEL } from '$lib/view/status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let view = $state<'month' | 'agenda'>('month');

	const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MON = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const anchor = $derived(new Date(data.anchorISO));
	const monthLabel = $derived(`${MON[anchor.getMonth()]} ${anchor.getFullYear()}`);
	const todayKey = dayKey(new Date());

	const qIndex = $derived(queueIndex([...store.extraQueue, ...library.queue]));
	const events = $derived(calendarEvents(data.items, qIndex));
	const byDay = $derived.by(() => {
		const m = new Map<string, CalEvent[]>();
		for (const e of events) {
			const arr = m.get(e.dayKey) ?? [];
			arr.push(e);
			m.set(e.dayKey, arr);
		}
		return m;
	});

	// 6 rows x 7 days from the grid start in +page.ts.
	const weeks = $derived.by(() => {
		const start = new Date(data.gridStartISO);
		const rows: { date: Date; key: string; inMonth: boolean; isToday: boolean }[][] = [];
		for (let w = 0; w < 6; w++) {
			const row = [];
			for (let d = 0; d < 7; d++) {
				const date = new Date(start);
				date.setDate(start.getDate() + w * 7 + d);
				const key = dayKey(date);
				row.push({
					date,
					key,
					inMonth: date.getMonth() === anchor.getMonth(),
					isToday: key === todayKey
				});
			}
			rows.push(row);
		}
		// drop a trailing all-out-of-month week (months that fit in 5 rows)
		return rows.filter((r) => r.some((c) => c.inMonth));
	});

	const agendaDays = $derived(
		[...byDay.entries()]
			.filter(([, evs]) => evs.some((e) => new Date(e.at).getMonth() === anchor.getMonth()))
			.map(([key, evs]) => {
				const d = new Date(evs[0].at);
				return {
					key,
					label: `${DOW[d.getDay()]}, ${MON[d.getMonth()].slice(0, 3)} ${d.getDate()}`,
					isToday: key === todayKey,
					events: evs
				};
			})
			.sort((a, b) => a.key.localeCompare(b.key))
	);

	function go(offset: number) {
		goto(`?m=${offset}`, { keepFocus: true, noScroll: true });
	}
</script>

<div
	style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap"
>
	<div>
		<h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:-.02em">Calendar</h1>
		<p style="margin:3px 0 0;font-size:13px;color:var(--sec)">Upcoming episodes and releases</p>
	</div>
	<div style="display:flex;align-items:center;gap:8px">
		<div style="display:flex;gap:2px;padding:2px;border:1px solid var(--bd);border-radius:6px">
			{#each ['month', 'agenda'] as v (v)}
				<button
					type="button"
					onclick={() => (view = v as 'month' | 'agenda')}
					style="height:26px;padding:0 12px;border:none;border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;text-transform:capitalize;background:{view ===
					v
						? 'var(--inv)'
						: 'transparent'};color:{view === v ? 'var(--invfg)' : 'var(--sec)'}">{v}</button
				>
			{/each}
		</div>
		<div style="display:flex;gap:2px">
			<button
				type="button"
				onclick={() => go(data.offset - 1)}
				aria-label="Previous month"
				class="at-bdh-t"
				style="display:grid;place-items:center;width:30px;height:30px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--sec);cursor:pointer;transition:border-color 120ms ease-out"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><path d="M15 5l-7 7 7 7" /></svg
				>
			</button>
			<button
				type="button"
				onclick={() => go(0)}
				disabled={data.offset === 0}
				class="at-bdh"
				style="height:30px;padding:0 11px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer;transition:border-color 120ms ease-out;opacity:{data.offset ===
				0
					? '.5'
					: '1'}">Today</button
			>
			<button
				type="button"
				onclick={() => go(data.offset + 1)}
				aria-label="Next month"
				class="at-bdh-t"
				style="display:grid;place-items:center;width:30px;height:30px;border-radius:6px;border:1px solid var(--bd);background:transparent;color:var(--sec);cursor:pointer;transition:border-color 120ms ease-out"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><path d="M9 5l7 7-7 7" /></svg
				>
			</button>
		</div>
	</div>
</div>

<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
	<h2 style="margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em">{monthLabel}</h2>
	<span style="font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
		>{events.length} event{events.length === 1 ? '' : 's'}</span
	>
</div>

{#if data.loadError}
	<div
		style="border:1px solid rgba(238,0,0,.3);border-radius:8px;background:var(--surf);padding:24px;text-align:center;font-size:13px;color:var(--sec)"
	>
		Couldn't load the calendar. Check that Sonarr / Radarr are reachable.
	</div>
{:else if view === 'month'}
	<div style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden">
		<div style="display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--bd)">
			{#each DOW as d (d)}
				<div
					style="padding:8px 10px;font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.05em"
				>
					{d}
				</div>
			{/each}
		</div>
		{#each weeks as week, wi (wi)}
			<div
				style="display:grid;grid-template-columns:repeat(7,1fr);{wi < weeks.length - 1
					? 'border-bottom:1px solid var(--bd)'
					: ''}"
			>
				{#each week as cell (cell.key)}
					{@const evs = byDay.get(cell.key) ?? []}
					<div
						style="min-height:104px;padding:6px;border-right:1px solid var(--bd);display:flex;flex-direction:column;gap:3px;background:{cell.inMonth
							? 'transparent'
							: 'var(--bg)'}"
					>
						<div style="display:flex;justify-content:flex-end">
							<span
								style="display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:6px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;background:{cell.isToday
									? 'var(--accent)'
									: 'transparent'};color:{cell.isToday
									? '#fff'
									: cell.inMonth
										? 'var(--sec)'
										: 'var(--muted)'}">{cell.date.getDate()}</span
							>
						</div>
						{#each evs.slice(0, 3) as e (e.key)}
							<a
								href={e.href}
								title={`${e.title} ${e.code}${e.ep ? ` · ${e.ep}` : ''}`}
								class="at-hov-bg"
								style="display:flex;align-items:flex-start;gap:5px;min-width:0;padding:2px 5px;border-radius:4px;font-size:11px;line-height:1.3;text-decoration:none;color:var(--text);transition:background 120ms ease-out"
							>
								<span
									style="flex:none;margin-top:4px;width:5px;height:5px;border-radius:50%;background:{STATUS_COLOR[
										e.status
									]}"
								></span>
								<span
									style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;color:var(--muted)"
									>{e.code}</span
								>
								<span
									style="flex:1;min-width:0;line-height:1.3;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"
									>{e.title}</span
								>
							</a>
						{/each}
						{#if evs.length > 3}
							<button
								type="button"
								onclick={() => (view = 'agenda')}
								class="at-ct"
								style="align-self:flex-start;padding:2px 5px;border:none;background:transparent;color:var(--muted);font-size:10px;font-weight:500;cursor:pointer"
								>+{evs.length - 3} more</button
							>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
{:else if agendaDays.length === 0}
	<div
		style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);padding:24px;text-align:center;font-size:13px;color:var(--muted)"
	>
		Nothing scheduled in {monthLabel}.
	</div>
{:else}
	<div style="display:flex;flex-direction:column;gap:14px">
		{#each agendaDays as day (day.key)}
			<section
				style="border:1px solid var(--bd);border-radius:8px;background:var(--surf);overflow:hidden"
			>
				<div
					style="padding:10px 14px;border-bottom:1px solid var(--bd);font-size:13px;font-weight:600;color:{day.isToday
						? 'var(--accent)'
						: 'var(--text)'}"
				>
					{day.label}{day.isToday ? ' · Today' : ''}
				</div>
				{#each day.events as e (e.key)}
					<a
						href={e.href}
						class="at-hov-bg"
						style="display:flex;align-items:center;gap:12px;padding:var(--rowpad);border-bottom:1px solid var(--bd);text-decoration:none;color:inherit;transition:background 120ms ease-out"
					>
						<span
							style="flex:none;width:44px;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--muted)"
							>{e.time || '—'}</span
						>
						<span
							style="flex:none;width:20px;text-align:center;font-family:'Geist Mono',ui-monospace,monospace;font-size:10px;border:1px solid var(--bd);border-radius:4px;color:var(--muted)"
							>{e.tag}</span
						>
						<span
							style="flex:none;min-width:0;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500"
							>{e.title}</span
						>
						<span
							style="flex:none;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--sec)"
							>{e.code}</span
						>
						<span
							style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--muted)"
							>{e.ep}</span
						>
						<span
							style="flex:none;font-size:11px;font-weight:500;padding:2px 7px;border-radius:6px;background:{STATUS_BADGE_BG[
								e.status
							]};color:{STATUS_COLOR[e.status]}">{STATUS_LABEL[e.status]}</span
						>
					</a>
				{/each}
			</section>
		{/each}
	</div>
{/if}
