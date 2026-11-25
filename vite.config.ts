import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// The page's own HTML says what the page is to a reader that runs no script (an agent that fetches the
// address as text, a browser with scripts off): public/index.md is put into the <noscript> of index.html,
// so the description is written once
function describePage (): Plugin {
  return {
    name: 'describe-page',
    transformIndexHtml (html) {
      const text = fs.readFileSync(path.resolve(__dirname, 'public/index.md'), 'utf8').replace(/\r\n/g, '\n').trim()
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      if (!html.includes('<!--page-description-->')) throw new Error('index.html has no place for the page description')
      return html.replace('<!--page-description-->', escaped)
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), describePage()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
