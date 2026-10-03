import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { resolveWorkspace, workspacePlugin } from './server/workspace.ts'

// Unit tests only. E2E lives in tests/e2e and runs with `pnpm test:e2e` against a dev server.
// Kept separate from vite.config.ts so the dev API plugin is not loaded here.
/**
 * The tests are written against the monoambiente example (its walls, rooms and
 * partitions), with the loft added so a workspace with two plans is covered too.
 */
function testWorkspace() {
  const ws = resolveWorkspace(process.cwd(), 'examples/monoambiente')
  return { ...ws, planFiles: [...ws.planFiles, path.resolve('examples/loft/plans/loft.plan.json')] }
}

export default defineConfig({
  plugins: [workspacePlugin(testWorkspace())],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Most modules touch window/document at import time (store, patterns).
    // Node-only suites opt out with `// @vitest-environment node`.
    environment: 'jsdom',
    setupFiles: ['tests/unit/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
