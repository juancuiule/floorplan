// Renders the app in headless Chromium and saves screenshots of each view.
// Usage: node scripts/shoot.mjs [outDir] [baseUrl] [view:mode ...]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [outDir = 'shots', base = 'http://localhost:5173', ...rest] = process.argv.slice(2)
const shots = rest.length
  ? rest
  : ['iso-balcony:dollhouse', 'iso-entry:dollhouse', 'iso-balcony:xray', 'top:dollhouse', 'from-balcony:dollhouse', 'from-entry:dollhouse']

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({
  // Reuse an already-downloaded Chromium when Playwright's pinned build is missing.
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

for (const spec of shots) {
  const [view, mode = 'dollhouse'] = spec.split(':')
  await page.goto(`${base}/?view=${view}&mode=${mode}`)
  await page.waitForFunction(() => (window.__frames ?? 0) > 40, null, { timeout: 60000 })
  const file = join(outDir, `${view}-${mode}.png`)
  await page.screenshot({ path: file })
  console.log('saved', file)
}
await browser.close()
