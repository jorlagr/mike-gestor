import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/mike-gestor/' : '/',
  plugins: [react()],
  test: { environment: 'node' },
})
