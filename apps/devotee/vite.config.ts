import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'

/** Public, indexable routes (static). Per-temple `/t/:slug` URLs are appended at build. */
const PUBLIC_ROUTES = [
  '/',
  '/temples',
  '/darshan',
  '/vrat',
  '/parayan',
  '/teachings',
  '/donate',
  '/shop',
  '/annadanam',
  '/community',
  '/recordings',
]

/** Files from public/ that make up the offline app shell. */
const SHELL_PUBLIC = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/fonts/jakarta-var-latin.woff2',
  '/fonts/marcellus-400.woff2',
]

function templeSlugs(): string[] {
  try {
    const src = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../packages/core/src/mock/temple.ts'),
      'utf8',
    )
    return [...src.matchAll(/^\s*slug:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1])
  } catch {
    return []
  }
}

/**
 * Hand-written PWA build support (no plugin dependency):
 *  - emits `sw-manifest.json` listing the hashed app-shell assets (entry + its static imports +
 *    css) that sw.js precaches;
 *  - stamps a build id into `sw.js` so every deploy produces a byte-different worker;
 *  - emits sitemap.xml with the static public routes and every `/t/:slug` temple.
 * Set VITE_SITE_URL (e.g. https://saibaba.example) for absolute sitemap URLs.
 */
function saibabaPwa(): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  let buildId = ''
  return {
    name: 'saibaba-pwa',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir)
      root = c.root
    },
    generateBundle(_o, bundle) {
      const assets = new Set<string>(SHELL_PUBLIC)
      const add = (f: string) => assets.add('/' + f)
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          add(item.fileName)
          item.imports.forEach(add)
          const meta = (item as unknown as { viteMetadata?: { importedCss: Set<string>; importedAssets: Set<string> } }).viteMetadata
          meta?.importedCss.forEach(add)
          meta?.importedAssets.forEach(add)
        }
      }
      const list = [...assets].sort()
      buildId = createHash('sha1').update(list.join('|')).digest('hex').slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sw-manifest.json',
        source: JSON.stringify({ version: buildId, assets: list }, null, 2),
      })

      const site = (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')
      const urls = [...PUBLIC_ROUTES, ...templeSlugs().map((s) => `/t/${s}`)]
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map((u) => `  <url><loc>${site}${u}</loc><lastmod>${today}</lastmod></url>`)
            .join('\n') +
          `\n</urlset>\n`,
      })
    },
    closeBundle() {
      const src = path.resolve(root, 'public/sw.js')
      const dest = path.join(outDir, 'sw.js')
      if (!fs.existsSync(src)) return
      fs.writeFileSync(dest, fs.readFileSync(src, 'utf8').replaceAll('__BUILD_ID__', buildId))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), saibabaPwa()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (/node_modules\/(react-router|react-router-dom)\//.test(id)) return 'router'
          if (/node_modules\/date-fns\//.test(id)) return 'date-fns'
          return undefined
        },
      },
    },
  },
})
