import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The inline marks public/index.md uses: `code` and bare links
const inlineHtml = (text: string) => escapeHtml(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/(^|\s)(https:\/\/[^\s<]+)/g, '$1<a href="$2">$2</a>')

// The blocks public/index.md uses: headings, paragraphs, one-level lists and indented code
function markdownToHtml (markdown: string) {
  return markdown.replace(/\r\n/g, '\n').trim().split(/\n{2,}/).map(block => {
    const heading = /^(#{1,3}) (.*)$/.exec(block)
    if (heading) return `<h${heading[1].length}>${inlineHtml(heading[2])}</h${heading[1].length}>`
    const rows = block.split('\n')
    if (rows.every(row => row.startsWith('- '))) return `<ul>${rows.map(row => `<li>${inlineHtml(row.slice(2))}</li>`).join('')}</ul>`
    if (rows.every(row => row.startsWith('    '))) return `<pre>${rows.map(row => inlineHtml(row.slice(4))).join('\n')}</pre>`
    return `<p>${inlineHtml(rows.join(' '))}</p>`
  }).join('\n')
}

// The page's own HTML says what the page is to a reader that runs no script (an agent that fetches the
// address as text, a browser with scripts off): public/index.md is put, as plain markup, where the scene
// will stand, so the description is written once. It is markup and not a <noscript>, because the text
// extractors such agents use throw a <noscript> away
function describePage (): Plugin {
  return {
    name: 'describe-page',
    transformIndexHtml (html) {
      if (!html.includes('<!--page-description-->')) throw new Error('index.html has no place for the page description')
      return html.replace('<!--page-description-->', markdownToHtml(fs.readFileSync(path.resolve(__dirname, 'public/index.md'), 'utf8')))
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
