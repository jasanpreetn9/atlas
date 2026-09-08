# Atlas code wiki

Atlas is a SvelteKit frontend for real Sonarr (TV) and Radarr (movies) instances.
It gives one unified library, dashboard, calendar, activity feed and "wanted" view
over both apps. It is a 1:1 port of the original design prototype, wired to live
data.

- Framework: SvelteKit 2, Svelte 5 (runes), TypeScript, Vite 8. Config lives
  inline in `vite.config.ts`; there is no `svelte.config.js`.
- Rendering: SSR is on with defaults. The shared data snapshot loads client-side
  on mount, so pages paint a shell first and then fill in.
- Styling: no component framework. Inline `style=""` is ported verbatim from the
  design, plus CSS custom properties and a few hover utility classes in
  [`src/lib/styles/atlas.css`](../src/lib/styles/atlas.css).
- Secrets: the Sonarr and Radarr API keys live only on the server. The browser
  talks only to same-origin proxy routes under `/api/*`.

## Pages

1. [Architecture](./01-architecture.md): the layers, the trust boundary, the request flow
2. [Project structure](./02-project-structure.md): every folder, one line each
3. [Data layer](./03-data-layer.md): `api/`, `server/`, the proxy routes, the stores
4. [View & UI layer](./04-view-and-ui.md): the `view/` mappers, components, the style tokens
5. [Routes](./05-routes.md): what each screen loads and renders, and which actions are real
6. [Conventions & recipes](./06-conventions.md): runes, porting rules, security, and how to add things

## Quick start

```sh
cp .env.example .env      # fill in SONARR_URL / SONARR_API_KEY / RADARR_URL / RADARR_API_KEY
npm install
npm run dev               # http://localhost:5173
npm run check             # svelte-check; must be 0 errors before shipping
npm run format            # prettier
```

At least one of Sonarr and Radarr must be configured. Screens that need the other
app render an empty state until it is set.
