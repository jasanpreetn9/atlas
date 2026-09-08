# Architecture

## The core constraint

API keys never reach the browser. The rest of the architecture follows from that.

The browser cannot call `https://sonarr.example.com` directly, because that
needs the key and shipping the key to the client defeats the point. Atlas puts a
thin proxy on its own origin instead: the browser calls `/api/sonarr/*` and
`/api/radarr/*`, and the SvelteKit server attaches the key and forwards the
request upstream.

## Layers

```
 browser                          server (SvelteKit)                 upstream
┌─────────────────────┐   fetch  ┌───────────────────────────┐  X-Api-Key ┌──────────┐
│ components / +page   │ ───────▶ │ routes/api/{sonarr,       │ ─────────▶ │ Sonarr   │
│ stores/  (rune data) │          │            radarr}/[...path]│           │ Radarr   │
│ view/    (mappers)   │ ◀─────── │   → lib/server/proxy       │ ◀───────── │  v3 API  │
│ lib/api/client.ts    │  JSON    │   → lib/server/http        │   JSON     └──────────┘
└─────────────────────┘          │   → lib/server/config      │
                                 └───────────────────────────┘
        shared: lib/api/{common,sonarr,radarr}.ts  (type definitions, both sides)
```

| Layer                | Directory                               | Runs          | Knows the key?   |
| -------------------- | --------------------------------------- | ------------- | ---------------- |
| Type contract        | `src/lib/api/{common,sonarr,radarr}.ts` | anywhere      | n/a              |
| Browser data client  | `src/lib/api/client.ts`                 | browser + SSR | no               |
| Proxy endpoints      | `src/routes/api/*/[...path]/+server.ts` | server        | yes (via config) |
| Proxy implementation | `src/lib/server/{proxy,http,config}.ts` | server only   | yes              |

`src/lib/server/` is server-only by SvelteKit rule. Importing it, or
`$env/dynamic/private` (which `config.ts` uses), from client-reachable code is a
build error. [Data layer](./03-data-layer.md) covers the `api/` vs `server/`
split in detail.

## Request flow

A component renders the Library screen:

1. `library.load()` (in `+layout.svelte` `onMount`) calls
   `createHttpApi(fetch).getSeries()`.
2. That does `fetch('/api/sonarr/series')`, same origin, no key.
3. `src/routes/api/sonarr/[...path]/+server.ts` receives it, resolves
   `getSonarrConfig()`, calls `proxyArr('sonarr', cfg, event)`.
4. `proxyArr` forwards `path + query + body` to `arrRequest(cfg, 'series', ...)`.
5. `arrRequest` does the real `fetch` to
   `https://sonarr.example.com/api/v3/series` with the `X-Api-Key` header,
   an 8s timeout, and an 8s in-memory GET cache.
6. JSON comes back up the chain untouched, with status and body relayed.

## Rendering model

### SSR

SSR is on (the SvelteKit default; nothing turns it off). The `+page.ts` `load()`
functions run on the server during the first request and again on the client
during navigation. During SSR, `fetch('/api/*')` is resolved by SvelteKit to the
`+server.ts` handler directly, with no real network hop.

### Shared data

`+layout.svelte` calls `library.load()` in `onMount`, so series, movies, queue
and the rest are fetched in the browser after the shell paints. Pages read
`library.*` and show skeletons or empty states while it loads. This keeps the
~600 KB library payload off the SSR critical path.

### Why not `+page.server.ts`

The secret boundary is already the proxy, so a server-only load adds nothing for
secrecy and forces a mandatory server round-trip on every client navigation. It
would only make sense if we dropped the public `/api/*` surface and made server
loads the sole path to the *arr instances. See
[Conventions](./06-conventions.md#load-functions).

## Configuration

`src/lib/server/config.ts` reads four vars from `$env/dynamic/private`:

```
SONARR_URL   SONARR_API_KEY
RADARR_URL   RADARR_API_KEY
```

`getSonarrConfig()` and `getRadarrConfig()` return `{ origin, baseUrl, apiKey }`,
or `null` when the pair is missing. On `null` the proxy answers `503 { error:
"<app> is not configured" }`, `client.ts` turns that into an `AppNotConfigured`
throw, and unified reads swallow it: they only fail when both apps are absent.
`.env` is git-ignored; `.env.example` documents the vars.
