import snapshot from "../data/links.snapshot.json"

export type LinkKind = "website" | "github" | "x" | "linkedin" | "instagram" | "cal"

export type MemberLink = { kind: LinkKind; href: string }

export type Member = {
  username: string
  name: string
  role: string
  location: string | null
  image: string | null
  url: string
  joinedYear: number | null
  links: MemberLink[]
}

export type Social = { label: string; href: string }

export type Product = {
  slug: string
  title: string
  tagline?: string
  url: string
  sourceUrl?: string
}

export type LinksData = {
  generatedAt: string
  source: string
  org: {
    name: string
    tagline: string
    url: string
    socials: Social[]
    products: Product[]
  }
  members: Member[]
}

const ENDPOINT = "https://crafter.run/links.json"

/**
 * crafter.run owns this data; we only render it. The committed snapshot is a
 * fallback, not a second source of truth: a Dokploy redeploy at 2am must not
 * fail because the sibling service is mid-deploy. Refresh it with `npm run sync`.
 */
async function load(): Promise<LinksData> {
  if (process.env.LINKS_OFFLINE === "1") {
    console.info("[links] LINKS_OFFLINE=1 - using the committed snapshot")
    return snapshot as LinksData
  }

  try {
    const response = await fetch(ENDPOINT, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = (await response.json()) as LinksData
    if (!Array.isArray(data?.members) || data.members.length === 0) {
      throw new Error("payload has no members")
    }
    if (!data.org?.socials?.length) {
      throw new Error("payload has no org links")
    }

    // `/links.json` is new, so a structurally-present but malformed payload is
    // a live possibility. Every member becomes a route and a card, and a
    // missing `username` would emit a page at `/undefined`. Fall back instead.
    const broken = data.members.find(
      (member) => !member?.username || !member?.name || !member?.url || !Array.isArray(member?.links),
    )
    if (broken) {
      throw new Error(`member ${broken.username ?? "<no username>"} is missing required fields`)
    }

    console.info(`[links] live: ${data.members.length} members from ${ENDPOINT}`)
    return data
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[links] ${ENDPOINT} unavailable (${reason}) - falling back to the committed snapshot`)
    return snapshot as LinksData
  }
}

const raw = await load()

// crafter.run does not publish products yet, and its Discord invite is stale.
// These are the projects and links we stand behind today.
const PRODUCTS: Product[] = [
  { slug: "makeables", title: "Makeables", tagline: "Stickers, badges y kits que diseñas con tu agente", url: "https://makeables.dev" },
  { slug: "petdex", title: "Petdex", tagline: "Mascotas animadas para Codex, Claude Code y más", url: "https://petdex.dev", sourceUrl: "https://github.com/crafter-station/petdex" },
  { slug: "elements", title: "Elements", tagline: "Bloques full-stack de shadcn/ui", url: "https://www.tryelements.dev", sourceUrl: "https://github.com/crafter-station/elements" },
  { slug: "text0", title: "text0", tagline: "Autocompletado inteligente y personal", url: "https://text0.dev", sourceUrl: "https://github.com/crafter-station/text0" },
  { slug: "hack0", title: "hack0", tagline: "Hackathons y eventos tech en LATAM", url: "https://hack0.dev", sourceUrl: "https://github.com/crafter-station/hack0" },
]

const SOCIAL_OVERRIDES: Record<string, string> = {
  Discord: "https://discord.gg/kgsjU4sD7",
}

const EXTRA_SOCIALS: Social[] = [{ label: "LinkedIn", href: "https://www.linkedin.com/company/crafter-station/" }]

export const links: LinksData = {
  ...raw,
  org: {
    ...raw.org,
    products: raw.org.products?.length ? raw.org.products : PRODUCTS,
    socials: [
      ...raw.org.socials.map((entry) => ({ ...entry, href: SOCIAL_OVERRIDES[entry.label] ?? entry.href })),
      ...EXTRA_SOCIALS.filter((extra) => !raw.org.socials.some((entry) => entry.label === extra.label)),
    ],
  },
}

export type NetworkArea = { id: string; name: string; tagline: string; url: string }

/** The four directions of the Crafter universe, in their crafter.run colours. */
export const NETWORK: (NetworkArea & { bg: string; ink: string })[] = [
  { id: "research", name: "Research", tagline: "Seguir las buenas preguntas", url: "https://crafter.ing", bg: "#dce6c9", ink: "#304a32" },
  { id: "lab", name: "Lab", tagline: "Ideas que toman forma física", url: "https://github.com/crafter-lab", bg: "#dce7ed", ink: "#324c60" },
  { id: "games", name: "Games", tagline: "La curiosidad también juega", url: "https://games.crafter.run", bg: "#e6def1", ink: "#554168" },
  { id: "station", name: "Station", tagline: "Construir se disfruta en compañía", url: "https://crafter.run/es", bg: "#f0e7bf", ink: "#554b27" },
]

export const LINK_LABELS: Record<LinkKind, string> = {
  website: "Website",
  github: "GitHub",
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  cal: "Agenda una llamada",
}

/** `https://www.linkedin.com/in/railly-hugo/` -> `linkedin.com/in/railly-hugo` */
export function displayHref(href: string): string {
  try {
    const url = new URL(href)
    const host = url.hostname.replace(/^www\./, "")
    const path = url.pathname.replace(/\/$/, "")
    return `${host}${path}`
  } catch {
    return href
  }
}

/** Local WebP written by `npm run sync`; falls back to crafter.run's PNG. */
export function avatarFor(member: Member): string {
  return `/team/${member.username}.webp`
}

export function memberBySlug(username: string): Member | undefined {
  return links.members.find((member) => member.username === username)
}
