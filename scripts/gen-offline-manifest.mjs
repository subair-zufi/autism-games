// Scans the media directories under public/ and writes public/offline-manifest.json
// (url + byte size for each file) so the offline downloader can show a
// byte-based progress bar. Run automatically before dev and build.
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../public', import.meta.url))
const DIRS = ['videos', 'emotions', 'groups', 'praise']

async function walk(absDir, relDir) {
  const out = []
  let entries
  try {
    entries = await readdir(absDir, { withFileTypes: true })
  } catch {
    return out // directory may not exist yet — skip it
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const abs = join(absDir, e.name)
    const rel = posix.join(relDir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walk(abs, rel)))
    } else {
      const { size } = await stat(abs)
      out.push({ url: rel, bytes: size })
    }
  }
  return out
}

const assets = []
for (const dir of DIRS) assets.push(...(await walk(join(ROOT, dir), dir)))
assets.sort((a, b) => a.url.localeCompare(b.url))

const manifest = { generatedAt: new Date().toISOString(), assets }
await writeFile(join(ROOT, 'offline-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`offline-manifest.json: ${assets.length} assets, ` +
  `${(assets.reduce((a, x) => a + x.bytes, 0) / 1e6).toFixed(1)} MB`)
