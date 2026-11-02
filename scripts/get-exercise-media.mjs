// Downloads the exercise photos and animations into public/exercises/.
// The media belongs to Gym visual (https://gymvisual.com/) and is not part of this
// repository; it is fetched from hasaneyldrm/exercises-dataset, which redistributes it at
// 180×180 with permission. Its use is governed by Gym visual's terms:
// https://gymvisual.com/content/3-terms-and-conditions-of-use
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main'
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/exercise-catalog.json'), 'utf8'))

const jobs = []
for (const item of catalog) {
  if (item.gif) jobs.push({ url: `${SOURCE}/videos/${item.gif}`, file: path.join(root, 'public/exercises/videos', item.gif) })
  if (item.image) jobs.push({ url: `${SOURCE}/images/${item.image}`, file: path.join(root, 'public/exercises/images', item.image) })
}
for (const dir of ['videos', 'images']) fs.mkdirSync(path.join(root, 'public/exercises', dir), { recursive: true })

const todo = jobs.filter((job) => !fs.existsSync(job.file))
let done = 0
let failed = 0
async function worker() {
  for (let job = todo.shift(); job; job = todo.shift()) {
    try {
      const response = await fetch(job.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      fs.writeFileSync(job.file, Buffer.from(await response.arrayBuffer()))
      done += 1
    } catch (error) {
      failed += 1
      console.warn(`Could not download ${path.basename(job.file)}: ${error.message}`)
    }
    if ((done + failed) % 100 === 0) console.log(`${done + failed} files…`)
  }
}
console.log(`${jobs.length - todo.length} of ${jobs.length} media files already here; downloading ${todo.length}.`)
await Promise.all(Array.from({ length: 8 }, worker))
console.log(`Done: ${done} downloaded${failed ? `, ${failed} failed (run it again to retry)` : ''}.`)
