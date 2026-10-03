// Spaces and the floor plan editor (docs/adr/0010): from the home page, make a
// space, draw a plan from nothing, open it in 3D, copy an example, and check that
// another space sees none of it.
import { expect, test } from '@playwright/test'
import { BASE_URL, watchErrors } from './lib.mjs'

/** Drags on the drawing from one plan point to another, in meters. */
async function drawRoom(page, [x0, z0], [x1, z1]) {
  const toScreen = (x, z) =>
    page.evaluate(
      ([x, z]) => {
        const p = new DOMPoint(x, z).matrixTransform(document.querySelector('.fp-canvas svg').getScreenCTM())
        return [p.x, p.y]
      },
      [x, z],
    )
  const [ax, ay] = await toScreen(x0, z0)
  const [bx, by] = await toScreen(x1, z1)
  await page.mouse.move(ax, ay)
  await page.mouse.down()
  await page.mouse.move(bx, by, { steps: 8 })
  await page.mouse.up()
}

async function clickAt(page, x, z) {
  const [sx, sy] = await page.evaluate(
    ([x, z]) => {
      const p = new DOMPoint(x, z).matrixTransform(document.querySelector('.fp-canvas svg').getScreenCTM())
      return [p.x, p.y]
    },
    [x, z],
  )
  await page.mouse.click(sx, sy)
}

const tool = (page, name) => page.locator('.fp-tools label', { hasText: new RegExp(`^${name}$`) }).click()

test('a new space, a plan drawn from scratch, opened in 3D', async ({ page }) => {
  const errors = watchErrors(page)

  await test.step('the home page makes a space', async () => {
    await page.goto(BASE_URL)
    await page.getByLabel('Name').fill('E2E home')
    await page.getByRole('button', { name: 'Create a space' }).click()
    await page.waitForURL(/\?space=[a-z0-9]+$/)
    await expect(page.locator('#space-title')).toHaveValue('E2E home')
  })
  const space = new URL(page.url()).searchParams.get('space')

  await test.step('draw two rooms with a door and a window', async () => {
    await page.getByRole('link', { name: /Draw a floor plan/ }).click()
    await page.waitForURL(/edit=floorplan/)
    await page.getByLabel('Name', { exact: true }).fill('Two rooms')
    await tool(page, 'Room')
    await drawRoom(page, [0, 0], [4, 3])
    await drawRoom(page, [4.05, 0], [6, 3]) // snaps onto the first room's edge
    await expect(page.locator('.fp-problems')).toContainText('There is no door yet')
    await tool(page, 'Door')
    await clickAt(page, 0, 1.5)
    await tool(page, 'Window')
    await clickAt(page, 6, 1.5)
    await expect(page.locator('.fp-problems')).toHaveCount(0)
  })

  await test.step('saving opens the plan in 3D', async () => {
    await page.getByRole('button', { name: 'Create and open in 3D' }).click()
    await page.waitForURL(/plan=two-rooms/)
    await page.waitForFunction(() => window.__decor?.getState().loaded && (window.__frames ?? 0) > 3, null, {
      timeout: 60000,
    })
    await expect(page.locator('.toolbar .title h1')).toContainText('Two rooms')
    // One partition between the rooms, which a layout can take out.
    const walls = await page.evaluate(async () => (await import('/src/project/plan.ts')).plan.shell.walls)
    expect(walls.filter((w) => w.kind === 'interior')).toHaveLength(1)
    expect(walls.flatMap((w) => (w.openings ?? []).map((o) => o.kind)).sort()).toEqual(['door', 'window'])
  })

  await test.step('the plan title leads back to the space, where an example can be copied', async () => {
    await page.locator('.toolbar .title').click()
    await page.waitForURL(new RegExp(`\\?space=${space}$`))
    await expect(page.getByRole('link', { name: 'Two rooms' })).toBeVisible()
    await page.getByRole('button', { name: /^Loft/ }).click()
    await page.waitForURL(/plan=loft/)
    await page.waitForFunction(() => window.__decor?.getState().loaded, null, { timeout: 60000 })
    expect(await page.evaluate(() => window.__decor.getState().items.length)).toBeGreaterThan(0)
  })

  await test.step('another space sees none of it', async () => {
    const res = await fetch(`${BASE_URL}/api/spaces`, { method: 'POST', body: JSON.stringify({ name: 'Other' }) })
    const { id } = await res.json()
    const other = await (await fetch(`${BASE_URL}/api/spaces/${id}`)).json()
    expect(other.plans).toEqual([])
    expect((await fetch(`${BASE_URL}/api/spaces/${id}/plans/two-rooms`)).status).toBe(404)
  })

  await test.step('a drawn plan opens in the editor again', async () => {
    await page.goto(`${BASE_URL}/?space=${space}&plan=two-rooms&edit=floorplan`)
    await expect(page.getByRole('heading', { name: 'Edit floor plan' })).toBeVisible()
    await expect(page.locator('.fp-room')).toHaveCount(2)
  })

  expect(errors).toEqual([])
})
