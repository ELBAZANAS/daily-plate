import { app, BrowserWindow, Menu, ipcMain, shell, utilityProcess } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

Menu.setApplicationMenu(null)

// The page is served from this fixed address so its saved data
// (browser storage is tied to the address) survives every update.
const PORT = 47321

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
}

function startStatic(root) {
  const base = path.resolve(root)
  const baseWithSep = base.endsWith(path.sep) ? base : base + path.sep
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1')
        let pathname = decodeURIComponent(url.pathname)
        if (pathname.endsWith('/')) pathname += 'index.html'
        const file = path.resolve(base, `.${pathname}`)
        if (file !== base && !file.startsWith(baseWithSep)) {
          res.writeHead(403)
          res.end()
          return
        }
        const send = (error, data, served = file) => {
          if (error) {
            // Exercise media also lives in the project's public folder; look there if the build lacks a file.
            const extra = served === file && pathname.startsWith('/exercises/') ? publicRoot() : ''
            if (extra) {
              const alt = path.resolve(extra, `.${pathname}`)
              if (alt.startsWith(extra + path.sep)) {
                fs.readFile(alt, (again, more) => send(again, more, alt))
                return
              }
            }
            res.writeHead(404)
            res.end()
            return
          }
          const ext = path.extname(file).toLowerCase()
          const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' }
          // Built files carry a content hash in their name, so they can be cached for good.
          // Everything else is checked each time, so a new build always shows up.
          if (pathname.startsWith('/assets/')) headers['Cache-Control'] = 'max-age=31536000, immutable'
          else if (pathname.startsWith('/exercises/')) headers['Cache-Control'] = 'max-age=604800'
          else headers['Cache-Control'] = 'no-cache'
          res.writeHead(200, headers)
          res.end(data)
        }
        fs.readFile(file, (error, data) => send(error, data))
      } catch {
        res.writeHead(400)
        res.end()
      }
    })
    server.on('error', reject)
    server.listen(PORT, '127.0.0.1', () => resolve(server))
  })
}

let publicCache
function publicRoot() {
  if (publicCache !== undefined) return publicCache
  publicCache = ''
  let dir = app.getAppPath()
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, 'public')
    if (fs.existsSync(path.join(candidate, 'exercises'))) {
      publicCache = path.resolve(candidate)
      break
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return publicCache
}

// The label reader needs the project's node_modules folder (it holds the OCR models).
function projectRoot() {
  let dir = app.getAppPath()
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, 'node_modules', '@gutenye', 'ocr-node', 'package.json'))
      && fs.existsSync(path.join(dir, 'launcher', 'read-label.mjs'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return ''
}

function systemNode() {
  const candidates = [
    'C:\\Program Files\\nodejs\\node.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'node.exe'),
  ]
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || 'node'
}

function collect(child, label, timeoutMs) {
  return new Promise((resolve, reject) => {
    let out = ''
    let err = ''
    let settled = false
    const done = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* already gone */ }
      done(reject, new Error('Reading the label took too long. Try a closer photo of the table.'))
    }, timeoutMs)
    child.stdout?.setEncoding?.('utf8')
    child.stdout?.on('data', (chunk) => { out += chunk })
    child.stderr?.on('data', (chunk) => { err += String(chunk) })
    child.on('error', (error) => done(reject, error))
    child.on('exit', (code) => {
      // Give the pipe a moment to flush the last chunk.
      setTimeout(() => {
        if (code === 0 && out.trim()) done(resolve, out)
        else done(reject, new Error(`${label} stopped (${code}). ${err.split('\n').filter(Boolean).slice(-2).join(' ')}`.trim()))
      }, 50)
    })
  })
}

async function readLabel(bytes) {
  const root = projectRoot()
  if (!root) throw new Error('The label reader is not installed next to the app. Paste the label text instead.')
  const script = path.join(root, 'launcher', 'read-label.mjs')
  const image = path.join(os.tmpdir(), `daily-plate-label-${Date.now()}.img`)
  fs.writeFileSync(image, Buffer.from(bytes))
  try {
    // First choice: Electron's own Node runtime, so no separate Node install is needed.
    try {
      const child = utilityProcess.fork(script, [image], { cwd: root, stdio: 'pipe', serviceName: 'Daily Plate label reader' })
      return await collect(child, 'The built-in reader', 90000)
    } catch (firstError) {
      // Second choice: a Node.js install on this computer.
      try {
        const child = spawn(systemNode(), [script, image], { cwd: root, windowsHide: true })
        return await collect(child, 'The Node reader', 90000)
      } catch {
        throw firstError
      }
    }
  } catch (error) {
    throw new Error(/too long/.test(error.message)
      ? error.message
      : 'The label could not be read. Try a straighter, closer photo, or paste the text.')
  } finally {
    fs.rmSync(image, { force: true })
  }
}

function backupDir() {
  return path.join(app.getPath('userData'), 'backups')
}

function saveBackup(json) {
  if (typeof json !== 'string' || json.length < 10 || json.length > 50 * 1024 * 1024) return false
  JSON.parse(json)
  const dir = backupDir()
  fs.mkdirSync(dir, { recursive: true })
  const latest = path.join(dir, 'daily-plate-latest.json')
  fs.writeFileSync(`${latest}.tmp`, json)
  fs.renameSync(`${latest}.tmp`, latest)
  const day = new Date()
  const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  fs.writeFileSync(path.join(dir, `daily-plate-${stamp}.json`), json)
  const daily = fs.readdirSync(dir).filter((name) => /^daily-plate-\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort()
  for (const old of daily.slice(0, Math.max(0, daily.length - 14))) fs.rmSync(path.join(dir, old), { force: true })
  return true
}

function windowStateFile() {
  return path.join(app.getPath('userData'), 'window.json')
}

function loadWindowState() {
  try {
    const saved = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'))
    if (saved.width >= 900 && saved.height >= 600) return saved
  } catch {
    // first launch
  }
  return { width: 1320, height: 880 }
}

function createWindow() {
  const root = app.getAppPath()
  const saved = loadWindowState()
  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#eceee9',
    title: 'Daily Plate',
    icon: path.join(root, 'launcher', 'DailyPlate.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(root, 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (saved.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('close', () => {
    try {
      const bounds = win.getNormalBounds()
      fs.writeFileSync(windowStateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }))
    } catch {
      // not important
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(`http://127.0.0.1:${PORT}`)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadURL(`http://127.0.0.1:${PORT}/`)
}

const locked = app.requestSingleInstanceLock()
if (!locked) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  ipcMain.handle('read-label', (_event, bytes) => readLabel(bytes))
  ipcMain.handle('save-backup', (_event, json) => saveBackup(json))
  ipcMain.handle('open-backups', () => {
    fs.mkdirSync(backupDir(), { recursive: true })
    return shell.openPath(backupDir())
  })
  app.whenReady().then(async () => {
    await startStatic(path.join(app.getAppPath(), 'dist'))
    createWindow()
  })
  app.on('window-all-closed', () => app.quit())
}
