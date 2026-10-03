import { existsSync, promises as fs, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

// A workspace is a directory with one apartment's data: its plans, its layouts
// and its artwork (docs/adr/0009-workspaces.md). The app opens one workspace,
// set by FLOORPLAN_WORKSPACE (in the environment or .env.local), relative to
// the project root:
//
//   <workspace>/workspace.json      { "name": "...", "defaultPlan": "<id>" }
//   <workspace>/plans/<id>.plan.json
//   <workspace>/layouts/decor*.json
//   <workspace>/artwork/*.png|jpg|webp|gif|avif

export const DEFAULT_WORKSPACE = 'examples/loft'

export interface Workspace {
  /** Absolute path of the workspace directory. */
  dir: string
  /** The setting it was opened from, relative to the project root. */
  setting: string
  name: string
  /** The plan that opens without ?plan=; its main layout is layouts/decor.json. */
  defaultPlan: string
  plansDir: string
  /** Its plan files (absolute paths), sorted. */
  planFiles: string[]
  layoutsDir: string
  artworkDir: string
}

export function resolveWorkspace(root: string, setting = DEFAULT_WORKSPACE): Workspace {
  const dir = path.resolve(root, setting)
  const configFile = path.join(dir, 'workspace.json')
  if (!existsSync(configFile))
    throw new Error(`FLOORPLAN_WORKSPACE=${setting}: no workspace.json in ${dir}. See docs/your-own-floorplan.md.`)
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as { name?: unknown; defaultPlan?: unknown }
  const plansDir = path.join(dir, 'plans')
  const plans = existsSync(plansDir) ? readdirSync(plansDir).filter((f) => f.endsWith('.plan.json')) : []
  const defaultPlan = typeof config.defaultPlan === 'string' ? config.defaultPlan : plans[0]?.replace('.plan.json', '')
  if (!defaultPlan || !plans.includes(`${defaultPlan}.plan.json`))
    throw new Error(`${configFile}: defaultPlan "${defaultPlan}" has no file in ${plansDir}`)
  return {
    dir,
    setting,
    name: typeof config.name === 'string' ? config.name : path.basename(dir),
    defaultPlan,
    plansDir,
    planFiles: plans.sort().map((f) => path.join(plansDir, f)),
    layoutsDir: path.join(dir, 'layouts'),
    artworkDir: path.join(dir, 'artwork'),
  }
}

const VIRTUAL = 'virtual:workspace'
const RESOLVED = '\0' + VIRTUAL

/**
 * Gives the app the open workspace: `virtual:workspace` exports its name,
 * default plan and every plan (imported as JSON, so editing one reloads the
 * page), `/artwork/*` is served from its artwork folder, and a build copies
 * that folder into the output.
 */
export function workspacePlugin(ws: Workspace): Plugin {
  return {
    name: 'floorplan-workspace',
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : null
    },
    load(id) {
      if (id !== RESOLVED) return null
      const imports = ws.planFiles.map((f, i) => `import p${i} from ${JSON.stringify(f)}`)
      const entries = ws.planFiles.map((f, i) => `${JSON.stringify(path.basename(f, '.plan.json'))}: p${i}`)
      return [
        ...imports,
        `export const name = ${JSON.stringify(ws.name)}`,
        `export const defaultPlan = ${JSON.stringify(ws.defaultPlan)}`,
        `export const plans = { ${entries.join(', ')} }`,
      ].join('\n')
    },
    configureServer(server) {
      // A plan added to or removed from the workspace: start over, so the workspace is read again.
      server.watcher.add(ws.plansDir)
      const restart = (file: string) => {
        if (path.dirname(file) === ws.plansDir && file.endsWith('.plan.json')) void server.restart()
      }
      server.watcher.on('add', restart)
      server.watcher.on('unlink', restart)
      server.middlewares.use('/artwork', async (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '')
        const file = path.join(ws.artworkDir, name)
        if (!name || path.dirname(file) !== ws.artworkDir) return next()
        try {
          const body = await fs.readFile(file)
          res.setHeader('Content-Type', CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
          res.end(body)
        } catch {
          next()
        }
      })
    },
    async generateBundle() {
      if (!existsSync(ws.artworkDir)) return
      for (const name of await fs.readdir(ws.artworkDir)) {
        if (!CONTENT_TYPES[path.extname(name).toLowerCase()]) continue
        this.emitFile({
          type: 'asset',
          fileName: `artwork/${name}`,
          source: await fs.readFile(path.join(ws.artworkDir, name)),
        })
      }
    },
  }
}

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}
