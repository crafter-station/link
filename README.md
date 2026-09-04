# link.crafter.run

The link-in-bio for [Crafter Station](https://crafter.run) and its crafters.

- `/` — the org's links: community, what we build, the crafters, follow along
- `/<username>` — one crafter's links, e.g. [`/railly`](https://link.crafter.run/railly)

Static Astro. No client framework, no analytics, ~240 KB for the whole site.

## Data

**crafter.run owns the data; this repo only renders it.**

At build time the site fetches `https://crafter.run/links.json` and falls back to
the committed `src/data/links.snapshot.json` if that endpoint is unreachable — a
redeploy here must never fail because the main site is mid-deploy.

> The `/links.json` endpoint does not exist upstream yet. Until the crafter.run
> PR adding it is merged, every build uses the snapshot. Nothing else changes
> when it lands.

The snapshot is derived from `apps/web/lib/team.ts` and `apps/web/lib/site.ts` in
[`crafter-station/crafter.run`](https://github.com/crafter-station/crafter.run).
It deliberately omits `email`: two members have one and one is a personal Gmail,
which is a bigger exposure as a JSON endpoint than as a TypeScript file.

Full profiles — bio, stack, hardware, projects — stay on crafter.run. Each
crafter's page links out to `crafter.run/en/team/<username>` rather than
restating any of it.

## Design

Tokens are copied verbatim from crafter.run's `app/globals.css` so the two sites
read as one system: Space Grotesk + JetBrains Mono, hairline borders, `0.5rem`
radius, wide-tracked uppercase mono micro-labels, and the warm cream accent that
only exists in dark mode (on white it measures 1.17:1, so light mode goes
monochrome and leans on weight and scale instead).

## Commands

```bash
npm install
npm run dev      # localhost:4321
npm run build    # -> dist/
npm run sync     # refresh the snapshot + regenerate 96px avatars
```

`npm run sync` re-downloads each crafter's avatar from crafter.run and writes a
96px WebP into `public/team/`. The upstream PNGs total ~18 MB (Gabriel's alone is
7 MB); the WebPs total ~28 KB. Pass `--force` to redo ones already present.

Set `LINKS_OFFLINE=1` to skip the live fetch and build purely from the snapshot.

## Deploy

Dokploy on the Crafter Station VPS, from a two-stage Dockerfile (`node:22-alpine`
build → `nginx:1.27-alpine` on `:80`). Pushing to `main` triggers a redeploy.
