// Where the dev server at `base` keeps its layouts: the open workspace's
// layouts/ folder (server/workspace.ts). Browser tests and scripts seed and
// read scratch layouts there; they never touch the real ones.
import { join } from 'node:path'

export async function layoutsDir(base) {
  const res = await fetch(`${base.replace(/\/$/, '')}/api/workspace`).catch(() => null)
  if (!res?.ok) throw new Error(`No dev API at ${base}: start the dev server first (pnpm dev).`)
  return (await res.json()).layouts
}

/** The file of layout `slug` (null: the main one) on the dev server at `base`. */
export async function layoutFile(base, slug) {
  return join(await layoutsDir(base), slug ? `decor.${slug}.json` : 'decor.json')
}
