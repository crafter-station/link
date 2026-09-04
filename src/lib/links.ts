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
    if (!data.org?.socials || !data.org?.products) {
      throw new Error("payload has no org links")
    }

    console.info(`[links] live: ${data.members.length} members from ${ENDPOINT}`)
    return data
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[links] ${ENDPOINT} unavailable (${reason}) - falling back to the committed snapshot`)
    return snapshot as LinksData
  }
}

export const links: LinksData = await load()

export const LINK_LABELS: Record<LinkKind, string> = {
  website: "Website",
  github: "GitHub",
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  cal: "Book a call",
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
