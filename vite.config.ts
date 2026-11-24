import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sceneBridge } from './tools/scene_bridge_plugin'

// https://vitejs.dev/config/
export default defineConfig({
  // sceneBridge runs on the dev server only: it lets agents drive the open tab through /__space
  plugins: [react(), sceneBridge()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
