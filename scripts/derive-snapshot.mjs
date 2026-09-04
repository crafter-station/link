/**
 * Derives the links payload straight from crafter.run's TypeScript source.
 *
 * This is the fallback path for `npm run sync`, used while
 * https://crafter.run/links.json does not exist yet (see crafter.run#81). It
 * parses `lib/team.ts` and `lib/site.ts` rather than importing them, because
 * they pull in `next/font`, i18n and the rest of that app's module graph.
 *
 * The output shape is identical to what the /links.json route returns, so the
 * day that endpoint ships, nothing downstream of the snapshot changes.
 *
 * Parsing TypeScript with regexes is only defensible because the shape is
 * narrow and verified: every extractor below throws if it finds nothing, so a
 * refactor upstream fails loudly here instead of silently emptying the site.
 */

const LINK_KINDS = ["website", "github", "x", "linkedin", "instagram", "cal"]

// Scalar member fields sit at exactly 4-space indentation. Nested objects
// (projects, stack, listening) are deeper, which is what stops a project's
// `name` from being read as the member's.
const MEMBER_SCALAR =
  /^ {4}(username|name|role|location|image|github|linkedin|x|instagram|website|cal|joinedYear): (.+?),?$/

export function parseMembers(teamSource) {
  const members = []
  let current = null

  for (const line of teamSource.split("\n")) {
    const match = line.match(MEMBER_SCALAR)
    if (!match) continue

    const [, key, raw] = match
    if (key === "username") {
      current = {}
      members.push(current)
    }
    if (!current) continue

    current[key] = raw.startsWith('"') ? raw.slice(1, -1) : Number(raw)
  }

  if (members.length === 0) throw new Error("lib/team.ts: no members parsed - the file shape changed")
  return members
}

export function parseSocials(siteSource) {
  // Scoped to the `socials` block: the locale switcher below it uses the exact
  // same `{ label, href }` shape and would otherwise fold EN/ES/PT/ZH/JA in.
  const block = siteSource.match(/export const socials = \[([\s\S]*?)\] as const/)
  if (!block) throw new Error("lib/site.ts: could not locate the socials array")

  const socials = [...block[1].matchAll(/\{ label: "(.+?)", href: "(.+?)" \}/g)].map(([, label, href]) => ({
    label,
    href,
  }))

  if (socials.length === 0) throw new Error("lib/site.ts: socials array parsed empty")
  return socials
}

export function parseProducts(siteSource) {
  const products = []
  let product = null

  for (const line of siteSource.split("\n")) {
    const slug = line.match(/^ {4}slug: "(.+?)",$/)
    if (slug) {
      product = { slug: slug[1] }
      products.push(product)
      continue
    }
    if (!product) continue

    const title = line.match(/^ {4}title: "(.+?)",$/)
    if (title) product.title = title[1]

    const tagline = line.match(/^ {4}tagline: \{ en: "(.+?)"/)
    if (tagline) product.tagline = tagline[1]

    const url = line.match(/^ {4}url: "(.+?)",$/)
    if (url) product.url = url[1]

    const sourceUrl = line.match(/^ {4}sourceUrl: "(.+?)",$/)
    if (sourceUrl) product.sourceUrl = sourceUrl[1]
  }

  const usable = products.filter((entry) => entry.url && entry.title)
  if (usable.length === 0) throw new Error("lib/site.ts: no products parsed - the file shape changed")
  return usable
}

export function deriveSnapshot({ teamSource, siteSource }) {
  const members = parseMembers(teamSource)

  return {
    generatedAt: new Date().toISOString(),
    source: "https://github.com/crafter-station/crafter.run",
    org: {
      name: "Crafter Station",
      tagline: "The LatAm network of shippers",
      url: "https://crafter.run",
      socials: parseSocials(siteSource),
      products: parseProducts(siteSource).map((product) => ({
        slug: product.slug,
        title: product.title,
        tagline: product.tagline,
        url: product.url,
        ...(product.sourceUrl ? { sourceUrl: product.sourceUrl } : {}),
      })),
    },
    // `email` is deliberately absent: two members have one, one of them is a
    // personal Gmail, and this file is published as part of a static site.
    members: members.map((member) => ({
      username: member.username,
      name: member.name,
      role: member.role,
      location: member.location ?? null,
      image: member.image ? `https://crafter.run${member.image}` : null,
      url: `https://crafter.run/en/team/${member.username}`,
      joinedYear: member.joinedYear ?? null,
      links: LINK_KINDS.flatMap((kind) => (member[kind] ? [{ kind, href: member[kind] }] : [])),
    })),
  }
}
