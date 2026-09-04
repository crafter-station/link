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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SNAPSHOT = path.join(root, "src/data/links.snapshot.json")
const AVATAR_DIR = path.join(root, "public/team")
const ENDPOINT = "https://crafter.run/links.json"
const SIZE = 96

async function refreshSnapshot() {
  try {
    const response = await fetch(ENDPOINT, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    if (!Array.isArray(data?.members) || data.members.length === 0) throw new Error("payload has no members")

    await writeFile(SNAPSHOT, `${JSON.stringify(data, null, 2)}\n`)
    console.log(`snapshot  updated from ${ENDPOINT} (${data.members.length} members)`)
    return data
  } catch (error) {
    // Expected until the crafter.run PR adding /links.json is merged.
    console.warn(`snapshot  ${ENDPOINT} unavailable (${error.message}) - keeping the committed snapshot`)
    return JSON.parse(await readFile(SNAPSHOT, "utf8"))
  }
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
        .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer()

      await writeFile(target, output)
      written += 1
      const kb = (n) => `${(n / 1024).toFixed(0)} KB`
      console.log(`avatar    ${member.username}: ${kb(source.length)} -> ${kb(output.length)}`)
    } catch (error) {
      console.error(`avatar    ${member.username}: FAILED (${error.message})`)
    }
  }

  console.log(`avatars   ${written} written, ${skipped} already present (use --force to redo)`)
}

const data = await refreshSnapshot()
await refreshAvatars(data.members)
