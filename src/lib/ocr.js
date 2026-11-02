// In-browser label reader, used when the app runs in a normal browser
// (npm run dev / the launcher). The desktop app reads labels natively instead.
import { groupRows } from './ocrRows.js'

let enginePromise = null

async function reader() {
  if (!enginePromise) {
    enginePromise = import('@paddleocr/paddleocr-js').then(({ PaddleOCR }) => PaddleOCR.create({
      lang: 'ch',
      ocrVersion: 'PP-OCRv5',
      ortOptions: {
        backend: 'wasm',
        wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/',
      },
    })).catch((error) => {
      enginePromise = null
      throw error
    })
  }
  return enginePromise
}

async function readCanvas(ocr, canvas) {
  const [result] = await ocr.predict(canvas, {
    textDetLimitSideLen: 1920,
    textDetLimitType: 'max',
    textRecScoreThresh: 0.25,
  })
  return groupRows(result?.items).join('\n')
}

function toCanvas(bitmap, invert) {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  if (invert) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = 255 - image.data[i]
      image.data[i + 1] = 255 - image.data[i + 1]
      image.data[i + 2] = 255 - image.data[i + 2]
    }
    ctx.putImageData(image, 0, 0)
  }
  return canvas
}

function isDark(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let total = 0
  let count = 0
  for (let i = 0; i < data.length; i += 64) {
    total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    count += 1
  }
  return count > 0 && total / count < 110
}

// Returns several readings; the caller keeps the most complete one.
export async function recognizeLabel(blob, onProgress) {
  onProgress?.('Loading the label reader. The first time it downloads, so stay online.')
  const ocr = await reader()
  onProgress?.('Reading the label…')
  const bitmap = await createImageBitmap(blob)
  try {
    const plain = toCanvas(bitmap, false)
    const texts = [await readCanvas(ocr, plain)]
    if (isDark(plain)) {
      onProgress?.('Reading light text on a dark package…')
      texts.push(await readCanvas(ocr, toCanvas(bitmap, true)))
    }
    return texts
  } finally {
    bitmap.close?.()
  }
}
