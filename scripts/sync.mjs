/**
 * Refreshes the two things this repo caches from crafter.run:
 *
 *   1. src/data/links.snapshot.json - the offline fallback for the build
 *   2. public/team/<username>.webp  - 96px avatars (the upstream PNGs run to
 *      7 MB each, which is not something a link-in-bio can ship)
 *
 * Run it whenever the team changes upstream:  npm run sync
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { deriveSnapshot } from "./derive-snapshot.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SNAPSHOT = path.join(root, "src/data/links.snapshot.json")
const AVATAR_DIR = path.join(root, "public/team")

const ENDPOINT = "https://crafter.run/links.json"
const RAW = "https://raw.githubusercontent.com/crafter-station/crafter.run/main/apps/web/lib"

const SIZE = 224

async function fetchText(url, timeout = 15_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

/** Tier 1: the published endpoint. What this should use once crafter.run#81 merges. */
async function fromEndpoint() {
  const body = await fetchText(ENDPOINT)
  const data = JSON.parse(body)
  if (!Array.isArray(data?.members) || data.members.length === 0) throw new Error("payload has no members")
  if (!data.org?.socials?.length) throw new Error("payload has no org links")
  return { data, via: ENDPOINT }
}

/**
 * Tier 2: crafter.run's TypeScript source on GitHub. Keeps the fallback
 * refreshable while /links.json does not exist, so the snapshot never has to be
 * hand-edited - which would quietly make it a second source of truth.
 */
async function fromSource() {
  const [teamSource, siteSource] = await Promise.all([fetchText(`${RAW}/team.ts`), fetchText(`${RAW}/site.ts`)])
  return { data: deriveSnapshot({ teamSource, siteSource }), via: `${RAW}/{team,site}.ts` }
}

async function refreshSnapshot() {
  const attempts = [
    ["endpoint", fromEndpoint],
    ["source", fromSource],
  ]

  for (const [label, attempt] of attempts) {
    try {
      const { data, via } = await attempt()
      await writeFile(SNAPSHOT, `${JSON.stringify(data, null, 2)}\n`)
      console.log(`snapshot  updated from ${via} (${data.members.length} members)`)
      return data
    } catch (error) {
      console.warn(`snapshot  ${label} unavailable (${error.message})`)
    }
  }

  console.warn("snapshot  every source failed - keeping the committed snapshot")
  return JSON.parse(await readFile(SNAPSHOT, "utf8"))
}

async function refreshAvatars(members) {
  await mkdir(AVATAR_DIR, { recursive: true })

  let written = 0
  let skipped = 0

  for (const member of members) {
    const target = path.join(AVATAR_DIR, `${member.username}.webp`)

    if (!member.image) {
      console.warn(`avatar    ${member.username}: no image upstream`)
      continue
    }
    if (existsSync(target) && !process.argv.includes("--force")) {
      skipped += 1
      continue
    }

    try {
      const response = await fetch(member.image, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const source = Buffer.from(await response.arrayBuffer())
      const output = await sharp(source)
        .resize(SIZE, SIZE, { fit: "cover", position: "top" })
        .webp({ quality: 82 })
        .toBuffer()

      await writeFile(target, output)
      written += 1
      const kb = (n) => `${(n / 1024).toFixed(1)} KB`
      console.log(`avatar    ${member.username}: ${kb(source.length)} -> ${kb(output.length)}`)
    } catch (error) {
      console.error(`avatar    ${member.username}: FAILED (${error.message})`)
    }
  }

  console.log(`avatars   ${written} written, ${skipped} already present (use --force to redo)`)
}

const data = await refreshSnapshot()
await refreshAvatars(data.members)
