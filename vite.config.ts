import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { studioApi } from './server/studioApi.ts'

export default defineConfig({
  plugins: [react(), studioApi()],
})
