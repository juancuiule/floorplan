// E2E smoke test: loads the app against an isolated decor file, drives the toolbar
// and the decor panel like a person would, and checks what gets saved.
//
//   BASE_URL=http://localhost:5184 CHROME_PATH=... node tests/e2e/smoke.mjs
//
// Writes only data/decor.e2e-smoke.json (git-ignored) through the dev API, and
// screenshots to test-results/e2e/ (git-ignored).
import assert from 'node:assert/strict'
import { api, BASE_URL, eventually, hover, launch, runner, shot, waitForScene } from './lib.mjs'

const DECOR = 'e2e-smoke'
const url = (params = '') => `${BASE_URL}/?decor=${DECOR}&dims=0${params ? `&${params}` : ''}`

const t = runner('e2e smoke')
console.log(`e2e smoke against ${BASE_URL}`)

try {
  const res = await fetch(`${BASE_URL}/api/decor?file=${DECOR}`)
  assert.equal(res.status, 200)
} catch (e) {
  console.error(`No dev server at ${BASE_URL} (${e.message}). Start one with: npx vite --port 5184 --strictPort`)
  process.exit(2)
}
await api.resetDecor(DECOR)

const { browser, page, errors } = await launch()
const panel = page.getByRole('complementary', { name: /decor/i })

/** Items saved to the isolated file that have actually been dropped in the room. */
const placed = async () => (await api.readDecor(DECOR)).items.filter((i) => i.at[1] > -50)

/**
 * Hovers and clicks candidate points until an item of `kind` shows up in the saved file.
 * Pixel positions depend on the camera, so a few nearby candidates keep this resilient.
 */
async function placeAtFirst(kind, candidates, before) {
  for (const [x, y] of candidates) {
    await hover(page, x, y)
    await page.mouse.click(x + 2, y)
    const found = await eventually(
      async () => {
        const items = await placed()
        return items.find((i) => i.kind === kind && !before.some((b) => b.id === i.id))
      },
      { timeout: 2500, message: `${kind} saved` },
    ).catch(() => null)
    if (found) return found
  }
  throw new Error(`Could not place a ${kind} at any of ${JSON.stringify(candidates)}`)
}

async function openTab(name) {
  const tab = panel.getByRole('tab', { name })
  await tab.click()
  await assert.doesNotReject(eventually(async () => (await tab.getAttribute('aria-selected')) === 'true', { message: `${name} tab selected` }))
}

/** Leaves the inspector (Esc deselects when nothing is being placed). */
async function deselect() {
  await page.mouse.move(700, 850)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
}

await t.step('loads with a canvas, toolbar and panel, and no page errors', async () => {
  await page.goto(url('view=iso-balcony'))
  await waitForScene(page)
  assert.ok(await page.locator('canvas').first().isVisible(), 'canvas visible')
  assert.equal(await page.getByRole('tab').count(), 4, 'four panel tabs')
  assert.deepEqual((await api.readDecor(DECOR)).items, [], 'isolated decor file starts empty')
  await shot(page, '01-loaded')
  assert.deepEqual(errors, [])
})

await t.step('switches dollhouse / x-ray', async () => {
  const xray = page.getByRole('radio', { name: /x-?ray/i })
  const doll = page.getByRole('radio', { name: /dollhouse/i })
  await xray.click()
  assert.equal(await xray.getAttribute('aria-checked'), 'true')
  assert.equal(await doll.getAttribute('aria-checked'), 'false')
  await page.waitForTimeout(600)
  await shot(page, '02-xray')
  await doll.click()
  assert.equal(await doll.getAttribute('aria-checked'), 'true')
})

await t.step('visits every camera preset', async () => {
  // Camera presets are a radio group in the toolbar; when the toolbar is narrow
  // (e.g. with the panel open) a select replaces it. Drive whichever is showing.
  const buttons = await page.getByRole('radiogroup', { name: /^camera$/i }).getByRole('radio').all()
  if (buttons.length) {
    for (const [i, b] of buttons.entries()) {
      await b.click()
      await page.waitForTimeout(700)
      await shot(page, `03-preset-${i}`)
    }
  } else {
    const select = page.getByRole('combobox', { name: /camera/i })
    const values = await select.locator('option').evaluateAll((os) => os.map((o) => o.value))
    assert.ok(values.length >= 3, `expected camera presets, found ${values.length}`)
    for (const [i, v] of values.entries()) {
      await select.selectOption(v)
      await page.waitForTimeout(700)
      await shot(page, `03-preset-${i}`)
    }
  }
  assert.deepEqual(errors, [])
})

await t.step('switches day / evening and the scene changes', async () => {
  await page.goto(url('view=iso-balcony'))
  await waitForScene(page)
  const day = await page.locator('canvas').first().screenshot()
  const evening = page.getByRole('radio', { name: /evening/i })
  await evening.click()
  assert.equal(await evening.getAttribute('aria-checked'), 'true')
  await page.waitForTimeout(900)
  const eve = await page.locator('canvas').first().screenshot()
  assert.ok(!day.equals(eve), 'evening render differs from day')
  await shot(page, '04-evening')
  await page.getByRole('radio', { name: /day/i }).click()
  assert.deepEqual(errors, [])
})

await t.step('opens every panel tab', async () => {
  const tabs = await panel.getByRole('tab').all()
  for (const tab of tabs) {
    await tab.click()
    assert.equal(await tab.getAttribute('aria-selected'), 'true')
    // Each library shows a heading and at least one choice.
    assert.ok(await panel.getByRole('heading').first().isVisible())
    assert.ok((await panel.locator('.lib-row, .thumb').count()) > 0 || /art/i.test(await tab.innerText()), 'library has choices')
  }
  await shot(page, '05-tabs')
})

await t.step('hangs artwork on the kitchen-side wall', async () => {
  await page.goto(url('view=iso-balcony'))
  await waitForScene(page)
  await openTab(/art/i)
  const thumbs = panel.locator('.thumb, button:has(img)')
  await eventually(async () => (await thumbs.count()) > 0, { timeout: 10000, message: 'artwork library' })
  const before = await placed()
  await thumbs.first().click()
  // Straight onto the floor: the draft has no valid spot yet, so a click there must not hang it.
  await hover(page, 640, 600)
  await page.mouse.click(642, 600)
  await page.waitForTimeout(700)
  assert.equal((await placed()).filter((i) => i.kind === 'artwork').length, 0, 'artwork rejected on the floor')
  const art = await placeAtFirst('artwork', [[520, 330], [560, 300], [480, 380], [600, 280]], before)
  assert.equal(art.facing, 'z-', 'faces into the room from the kitchen-side wall')
  assert.ok(art.at[2] > 2.7 && art.at[2] <= 3.01, `on the wall surface, z=${art.at[2]}`)
  assert.ok(art.at[1] > 0.2 && art.at[1] < 2.6, `at a sensible height, y=${art.at[1]}`)
  assert.equal(art.host, 'side-kitchen')
  assert.match(art.image, /^\/artwork\//)
  await shot(page, '06-artwork')
  await deselect()
})

await t.step('sets a plant on the main-room floor', async () => {
  await page.goto(url('view=top'))
  await waitForScene(page)
  await openTab(/plant/i)
  const before = await placed()
  await panel.getByRole('button', { name: /monstera/i }).click()
  const p = await placeAtFirst('plant', [[750, 440], [700, 470], [820, 420]], before)
  assert.equal(p.species, 'monstera')
  assert.ok(Math.abs(p.at[1]) < 0.02, `on the floor, y=${p.at[1]}`)
  assert.ok(p.at[0] > 2.2 && p.at[0] < 6.9 && p.at[2] > 0 && p.at[2] < 3, `in the main room: ${p.at}`)
  await shot(page, '07-plant')
  await deselect()
})

await t.step('sets a floor lamp down and hangs a pendant at the ceiling', async () => {
  await openTab(/light/i)
  let before = await placed()
  await panel.getByRole('button', { name: /arc/i }).first().click()
  const arc = await placeAtFirst('lamp', [[620, 500], [600, 520], [660, 480]], before)
  assert.equal(arc.type, 'arc')
  assert.ok(Math.abs(arc.at[1]) < 0.02, `arc on the floor, y=${arc.at[1]}`)
  assert.equal(arc.on, true)
  await deselect()

  await openTab(/light/i)
  before = await placed()
  await panel.getByRole('button', { name: /pendant/i }).first().click()
  const pendant = await placeAtFirst('lamp', [[880, 380], [860, 400]], before)
  assert.ok(['pendant', 'globe'].includes(pendant.type))
  assert.equal(pendant.at[1], 2.6, 'hangs from the 2.60 main-room ceiling')
  await shot(page, '08-lamps')
  await deselect()
})

await t.step('snaps a standing desk flush to the bath-side wall', async () => {
  await openTab(/furniture/i)
  const before = await placed()
  await panel.getByRole('button', { name: /standing desk/i }).click()
  // Near the bath-side (top) edge of the main room in the top view, z ≈ 0.3–0.5 m.
  const desk = await placeAtFirst('furniture', [[760, 325], [740, 335], [800, 320]], before)
  assert.equal(desk.type, 'standingDesk')
  assert.equal(desk.rotation, 0, 'faces into the room')
  assert.equal(desk.at[2], Number((desk.size[2] / 2).toFixed(2)), `backed onto the wall at z = depth / 2, got ${desk.at[2]}`)
  await shot(page, '09-desk')
  await deselect()
})

await t.step('Esc cancels a placement without saving it', async () => {
  const n = (await placed()).length
  await openTab(/plant/i)
  await panel.getByRole('button', { name: /fern/i }).click()
  await hover(page, 700, 450)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  const after = await placed()
  assert.equal(after.length, n)
  assert.ok(!after.some((i) => i.kind === 'plant' && i.species === 'fern'))
})

await t.step('the saved file has one of each kind and survives a reload', async () => {
  const items = await placed()
  const kinds = new Set(items.map((i) => i.kind))
  assert.deepEqual([...kinds].sort(), ['artwork', 'furniture', 'lamp', 'plant'])
  await page.goto(url('view=iso-balcony'))
  await waitForScene(page)
  // The "In the room" list (all kinds, grouped) shows the saved lamps after reload.
  const toggle = panel.locator('#room-toggle')
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  const listed = await panel.getByRole('group', { name: /light/i }).locator('li').count()
  assert.equal(listed, items.filter((i) => i.kind === 'lamp').length)
  await page.getByRole('radio', { name: /evening/i }).click()
  await page.waitForTimeout(900)
  await shot(page, '10-final-evening')
  assert.deepEqual(errors, [])
})

await browser.close()
if (errors.length) console.log('Page errors:\n  ' + errors.join('\n  '))
t.done()
