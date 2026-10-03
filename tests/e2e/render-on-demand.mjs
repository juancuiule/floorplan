// Checks that on-demand rendering still animates: x-ray fade, preset camera moves,
// dollhouse cut-away, desk height tween. Saves shots into outDir.
// Usage: node tests/e2e/render-on-demand.mjs outDir baseUrl
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [outDir = 'test-results/render-on-demand', base = 'http://localhost:5173'] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const file = 'data/decor.furn.json'
const original = readFileSync(file, 'utf8')

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
const frames = () => page.evaluate(() => window.__frames)
const shot = (n) => page.screenshot({ path: join(outDir, `${n}.png`) })

await page.goto(`${base}/?view=iso-balcony&decor=furn&dims=0`)
await page.waitForFunction(() => (window.__frames ?? 0) > 40, null, { timeout: 60000 })
await page.waitForTimeout(1500)
let f = await frames()
await page.waitForTimeout(1000)
console.log('idle frames in 1s:', (await frames()) - f)

f = await frames()
await page.getByRole('radio', { name: 'X-ray' }).click()
await page.waitForTimeout(150)
await shot('xray-mid')
await page.waitForTimeout(1200)
console.log('frames during x-ray fade:', (await frames()) - f)
await shot('xray-end')
await page.getByRole('radio', { name: 'Dollhouse' }).click()
await page.waitForTimeout(1200)

f = await frames()
await page.getByRole('button', { name: 'Iso · entry' }).click()
await page.waitForTimeout(250)
await shot('preset-mid')
await page.waitForTimeout(2000)
console.log('frames during preset move:', (await frames()) - f)
await shot('preset-iso-entry')

f = await frames()
await page.getByRole('button', { name: 'From entry' }).click()
await page.waitForTimeout(2500)
console.log('frames to from-entry:', (await frames()) - f)
await shot('preset-from-entry')
await page.getByRole('button', { name: 'Iso · balcony' }).click()
await page.waitForTimeout(2500)

// Raise the desk by editing the layout on disk (the dev server pushes the change).
const data = JSON.parse(original)
data.items.find((i) => i.type === 'standingDesk').size[1] = 1.15
f = await frames()
writeFileSync(file, JSON.stringify(data, null, 2))
await page.waitForTimeout(700)
await shot('desk-mid')
await page.waitForTimeout(2500)
console.log('frames during desk tween:', (await frames()) - f)
await shot('desk-up')
writeFileSync(file, original)
await page.waitForTimeout(2500)
await shot('desk-down')

// Click the wardrobe: pointer events must reach the merged meshes and select it.
f = await frames()
await page.mouse.click(740, 520)
await page.waitForTimeout(500)
const selected = await page.evaluate(() => {
  let found = false
  window.__scene?.traverse((o) => (found ||= o.type === 'Box3Helper' && o.visible))
  return found
})
console.log('wardrobe click selects:', selected, 'frames:', (await frames()) - f)
await shot('selected')
await page.keyboard.press('Escape')
await page.mouse.click(1000, 850)
await page.waitForTimeout(300)

// Orbit drag with the mouse.
f = await frames()
await page.mouse.move(120, 700) // empty background, not a piece of furniture
await page.mouse.down()
await page.mouse.move(40, 690, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(1500)
console.log('frames during orbit:', (await frames()) - f)
await shot('orbit')
await browser.close()
