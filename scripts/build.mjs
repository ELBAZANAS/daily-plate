// Builds the desktop app into dist/: one small JS bundle (+ chunks), one CSS file,
// the fonts, and the public/ folder. Run with `npm run build`.
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const assets = path.join(dist, 'assets')

fs.rmSync(assets, { recursive: true, force: true })
fs.mkdirSync(assets, { recursive: true })

const result = await build({
  absWorkingDir: root,
  entryPoints: { app: 'src/main.jsx' },
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: ['chrome120'],
  outdir: assets,
  entryNames: '[name]-[hash]',
  chunkNames: 'chunk-[hash]',
  assetNames: '[name]-[hash]',
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.woff2': 'file' },
  define: {
    'import.meta.env.BASE_URL': '"./"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'process.env.NODE_ENV': '"production"',
  },
  alias: { '@paddleocr/paddleocr-js': './scripts/ocr-stub.js' },
  metafile: true,
  logLevel: 'warning',
})

const outputs = Object.keys(result.metafile.outputs).map((file) => path.relative(dist, path.join(root, file)).split(path.sep).join('/'))
const js = outputs.find((file) => /^assets\/app-[^/]+\.js$/.test(file))
const css = outputs.find((file) => /^assets\/app-[^/]+\.css$/.test(file))
if (!js || !css) throw new Error(`Build output is missing the app bundle: ${outputs.join(', ')}`)

// public/ is copied as it is, except the old upscaled exercise copies, which the app no longer loads.
const skip = new Set(['exercises/hd', 'exercises/hdpack'])
function copy(from, to, rel = '') {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name
    if (skip.has(relPath)) continue
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true })
      copy(src, dst, relPath)
    } else {
      const stat = fs.statSync(src)
      const old = fs.existsSync(dst) ? fs.statSync(dst) : null
      if (!old || old.size !== stat.size || old.mtimeMs < stat.mtimeMs) fs.copyFileSync(src, dst)
    }
  }
}
copy(path.join(root, 'public'), dist)

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/\s*<script type="module" src="\/src\/main\.jsx"><\/script>/, `\n    <script type="module" src="./${js}"></script>`)
  .replace('</head>', `  <link rel="stylesheet" href="./${css}" />\n  </head>`)
fs.writeFileSync(path.join(dist, 'index.html'), html)

const size = (file) => `${Math.round(fs.statSync(path.join(dist, file)).size / 1024)} KB`
console.log(`Built dist/: ${outputs.map((file) => `${file} (${size(file)})`).join(', ')}`)
