// Shared helpers for the e2e smoke tests (plain `playwright`, run with node).
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const BASE_URL = (process.env.BASE_URL || 'http://localhost:5184').replace(/\/$/, '')
export const SHOTS = process.env.SHOTS_DIR || 'test-results/e2e'
mkdirSync(SHOTS, { recursive: true })

export async function launch() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    headless: process.env.HEADED ? false : true,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // Benign noise: React dev warnings about unmounts, and missing favicons.
    if (/unmount|favicon/i.test(t)) return
    errors.push(`console: ${t}`)
  })
  return { browser, page, errors }
}

/**
 * Waits until the scene has rendered. Works with continuous rendering (window.__frames
 * keeps climbing), on-demand rendering (a few frames, then idle) and an explicit
 * window.__ready flag if the app ever sets one.
 */
export async function waitForScene(page, { timeout = 60000 } = {}) {
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout })
  await page
    .waitForFunction(() => window.__ready === true || (window.__frames ?? 0) >= 3, null, {
      timeout: Math.min(timeout, 20000),
    })
    .catch(() => {})
  // Let textures, decor and the first shadow maps settle.
  await page.waitForTimeout(800)
}

/**
 * Jumps the pointer to (x, y) without passing over anything on the way (a draft
 * sticks to the last valid surface it crossed), then nudges it so hover-driven
 * placement and on-demand renders update.
 */
export async function hover(page, x, y) {
  await page.mouse.move(x, y, { steps: 1 })
  for (let i = 1; i < 3; i++) await page.mouse.move(x + i, y, { steps: 1 })
  await page.waitForTimeout(150)
}

export async function shot(page, name) {
  const path = join(SHOTS, `${name}.png`)
  await page.screenshot({ path })
  return path
}

export const api = {
  async readDecor(name) {
    const res = await fetch(`${BASE_URL}/api/decor?file=${name}`)
    assert.equal(res.status, 200, `GET decor ${name}`)
    return res.json()
  },
  async resetDecor(name) {
    const res = await fetch(`${BASE_URL}/api/decor?file=${name}`, {
      method: 'PUT',
      body: JSON.stringify({ version: 1, items: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    assert.equal(res.status, 200, `reset decor ${name}`)
  },
}

/** Polls `fn` until it returns a truthy value (or throws after `timeout`). */
export async function eventually(fn, { timeout = 5000, interval = 150, message = 'condition' } = {}) {
  const end = Date.now() + timeout
  let last
  while (Date.now() < end) {
    try {
      last = await fn()
      if (last) return last
    } catch (e) {
      last = e
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error(`Timed out waiting for ${message}${last instanceof Error ? `: ${last.message}` : ''}`)
}

/** Tiny test runner: sequential, prints a line per step, exits non-zero on failure. */
export function runner(title) {
  const results = []
  return {
    async step(name, fn) {
      const t0 = Date.now()
      try {
        await fn()
        results.push({ name, ok: true })
        console.log(`  ✓ ${name} (${Date.now() - t0} ms)`)
      } catch (e) {
        results.push({ name, ok: false, e })
        console.log(
          `  ✗ ${name}\n    ${String(e?.stack ?? e)
            .split('\n')
            .slice(0, 6)
            .join('\n    ')}`,
        )
      }
    },
    done() {
      const failed = results.filter((r) => !r.ok)
      console.log(`\n${title}: ${results.length - failed.length} passed, ${failed.length} failed`)
      if (failed.length) process.exitCode = 1
      return failed.length === 0
    },
  }
}
