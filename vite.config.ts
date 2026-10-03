import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { studioApi } from './server/studioApi.ts'
import { DEFAULT_WORKSPACE, resolveWorkspace, workspacePlugin } from './server/workspace.ts'

export default defineConfig(({ mode }) => {
  // FLOORPLAN_WORKSPACE picks the apartment to open; set it in .env.local to work on your own.
  const env = loadEnv(mode, process.cwd(), 'FLOORPLAN_')
  const ws = resolveWorkspace(process.cwd(), env.FLOORPLAN_WORKSPACE || DEFAULT_WORKSPACE)
  return {
    plugins: [react(), workspacePlugin(ws), studioApi(ws)],
  }
})
