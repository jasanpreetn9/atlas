# Conventions & recipes

## Svelte 5 runes

Runes mode is forced project-wide (`vite.config.ts`, `compilerOptions.runes`).

- State is `let x = $state(...)`. Derived values are `const y = $derived(expr)` or
  `$derived.by(() => { ... })`. Effects are `$effect(() => { ... })`. Props are
  `let { a, b } = $props()`.
- Stores are classes with `$state` fields, exported as a single instance
  (`export const store = new AtlasStore()`), not `writable()`. Mutating a `$state`
  array by index (`library.movies[idx] = saved`) is reactive.
- Use snippets instead of slots: `{#snippet name(args)}` and
  `{@render name(args)}` (see `Poster.svelte`).
- Events are attributes: `onclick={...}`, not `on:click`.

## Porting the design

The original design prototype is the source of truth for layout.

- Inline `style=""` is copied verbatim from the design's markup. Don't refactor it
  into classes. That is deliberate: it keeps every element diffable against the
  prototype.
- The design's per-element hover and focus styles map to one of the `.at-*`
  utility classes in `styles/atlas.css`
  ([table](./04-view-and-ui.md#srclibstylesatlascss)). Add a new one only when a
  hover pattern recurs.
- The design's `SC` / `SL` / `SB` maps become `STATUS_COLOR` / `STATUS_LABEL` /
  `STATUS_BADGE_BG` in `view/status.ts`.
- The prototype's mock data generators are not ported. Their output shape is
  reproduced by the `view/` mappers from real data.

## Real vs. stubbed

Nearly everything is wired to the live instances now; `notYet(label)` (the
`"... isn't wired up yet"` toast) only remains for Manual Import on a movie
queue row (`/activity`) - Radarr has no manual-import endpoint equivalent
wired up client-side, so there's nothing to call yet.

Pause / Pause all on the queue tab were removed outright rather than stubbed:
pausing a download is a download-client capability, not something the *arr
REST API exposes, so there's no realistic call to eventually wire up.

When adding an action, make it real if it's a safe read or an idempotent
write, or if the destructive path already has confirm UI (`ConfirmModal`).
Stub it with `notYet(label)` only when the backend call genuinely doesn't
exist yet and confirm UI hasn't been built. If an action can _never_ become
real (no matching API endpoint, ever), remove it instead of stubbing it - say
which, and why, in the PR.

## Security constraints (do not regress)

- API keys stay server-side. The browser only ever calls `/api/*`. Never import
  `$lib/server/*` or `$env/dynamic/private` into client-reachable code.
- `.env` is git-ignored and holds the real credentials; `.env.example` is the
  template.
- Don't trigger a real Grab while smoke-testing. It starts a real download on the
  user's setup. Verify the interactive-search listing, not the button.
- The user's email is for attribution only. Never put it in a request.

## Commands

```sh
npm run dev      # vite dev, :5173
npm run check    # svelte-kit sync && svelte-check; must be 0 errors / 0 warnings
npm run format   # prettier --write .
npm run build    # adapter-auto
```

Run `npm run check` and `npm run format` before every commit.

---

## Recipes

### Add a new screen (for example `/calendar`)

1. `src/routes/calendar/+page.ts`: a `load()` using `createHttpApi(fetch)` and
   `Promise.allSettled`; return the data plus a `loadErrors` string list.
2. `src/routes/calendar/+page.svelte`: read `library.*` for shared data and
   `data.*` for page data; `$derived` the view-models via `src/lib/view`; port the
   markup from the corresponding block in the design prototype.
3. The nav entry already exists in `stores/nav.ts`, and `activeNavKey` already
   handles the path prefix.
4. Run `npm run check`, then verify in the browser against live data.

### Add an API method

1. Add it to the `AtlasApi` interface in `api/client.ts` and implement it in
   `createHttpApi` using the `s()`, `r()`, `both()` and `forKind()` helpers.
2. If it needs a type that isn't in `api/{common,sonarr,radarr}.ts`, add the
   interface there and match the OpenAPI spec field names.
3. No proxy change is needed; `[...path]/+server.ts` forwards any path. Only touch
   `server/proxy.ts` for special timeout or cache handling, as `release` has.

### Add a `view/` mapper

Put it in the file that owns that screen's concern (`activity.ts` for feed rows,
`wanted.ts` for missing and action rows, `media.ts` for the unified item, and so
on). Keep it pure: inputs are `*Resource` objects plus lookup `Map`s plus an
optional `now = new Date()`; output is plain objects and strings. No imports from
`svelte`, `$app`, or `$lib/stores`.

### Add a global modal

Create it under `components/modals/`, add open/close state plus an action to
`store.svelte.ts`, and render it once at the bottom of `+layout.svelte`, next to
`InteractiveSearch`, `EpisodeModal` and `TableOptions`.

---

## Load functions

`+page.ts` is used rather than `+page.server.ts`. The secret boundary is the
`/api/*` proxy, not the load function: `+page.ts` calls the proxy with plain
`fetch` and never sees a key. A `+page.server.ts` would add a second server layer
doing the same key injection, force a mandatory server round-trip on every client
navigation, and split the data path (universal `load` all goes through
`api/client.ts`, whereas a server `load` would need `server/sonarr.ts`). It would
only pay off if the public `/api/*` surface were removed and server loads made the
sole path upstream.
