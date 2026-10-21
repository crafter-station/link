# link.crafter.run

The link-in-bio for [Crafter Station](https://crafter.run) and its crafters.

- `/` — the org's links: community, what we build, the crafters, follow along
- `/<username>` — one crafter's links, e.g. [`/railly`](https://link.crafter.run/railly)

Static Astro. No client framework, no analytics, ~240 KB for the whole site.

## Data

**crafter.run owns the data; this repo only renders it.**

At build time the site fetches `https://crafter.run/links.json` and falls back to
the committed `src/data/links.snapshot.json` if that endpoint is unreachable or
returns a payload missing required fields — a redeploy here must never fail, or
render `/undefined`, because the main site is mid-deploy.

> The `/links.json` endpoint does not exist upstream yet
> ([crafter.run#81](https://github.com/crafter-station/crafter.run/pull/81)).
> Until it merges, **every build uses the snapshot.** Nothing else changes when
> it lands.

Because the snapshot is load-bearing until then, it is never hand-edited.
`npm run sync` refreshes it through three tiers, in order:

| # | Source | When |
|---|---|---|
| 1 | `https://crafter.run/links.json` | Once #81 ships — the intended path |
| 2 | `lib/team.ts` + `lib/site.ts`, raw from GitHub | Today. Parsed by `scripts/derive-snapshot.mjs` into the exact shape tier 1 will return |
| 3 | The committed snapshot | Everything upstream is unreachable |

Tier 2 exists so the fallback stays refreshable while there is no endpoint to
fetch. Its parsers throw if they match nothing, so an upstream refactor fails
loudly here rather than silently emptying the site.

The data deliberately omits `email`: two members have one and one is a personal
Gmail, which is a bigger exposure as a published JSON file than as TypeScript.

Full profiles — bio, stack, hardware, projects — stay on crafter.run. Each
crafter's page links out to `crafter.run/en/team/<username>` rather than
restating any of it.

## Design

Crafter's dark palette and type from [crafter.run/design.md](https://crafter.run/design.md): deep olive canvas, warm paper text, station soft yellow as the one accent, Crafter Sans Display and Text (SIL OFL, `public/fonts`). The background is the micelio WebGL shader from [linkmi](https://github.com/sofiaferro/linkmi) by Sofía Ferro, credited in the footer, tinted to that palette, with linkmi-style numbered glass rows. The universe tiles use the four area colours from crafter.run/universe.

Products, the LinkedIn page and the Discord invite are set in `src/lib/links.ts` while `crafter.run/links.json` publishes no products.

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
