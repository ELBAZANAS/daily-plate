import Ocr from '@gutenye/ocr-node'
import sharp from 'sharp'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { groupRows } from '../src/lib/ocrRows.js'

const file = process.argv[2]
if (!file) {
  process.stderr.write('Missing image path\n')
  process.exit(1)
}

const KEYS = [
  ['饱和脂肪', 'saturated'],
  ['反式脂肪', 'trans'],
  ['碳水化合物', 'carbs'],
  ['膳食纤维', 'fiber'],
  ['蛋白质', 'protein'],
  ['能量', 'energy'],
  ['蛋白', 'protein'],
  ['脂肪', 'fat'],
  ['碳水', 'carbs'],
  ['纤维', 'fiber'],
  ['糖', 'sugar'],
  ['钠', 'sodium'],
  ['钙', 'calcium'],
  ['铁', 'iron'],
  ['锌', 'zinc'],
]

const FIELDS = [
  { word: '能量', test: /能量|热量|熱量|\benergy\b|\bcalories\b/i, kind: 'energy' },
  { word: '蛋白质', test: /蛋白质|蛋白質|蛋白|\bprotein\b/i, kind: 'g' },
  { word: '脂肪', test: /脂肪|\bfat\b/i, reject: /饱和|飽和|反式|saturated|trans/i, kind: 'g' },
  { word: '饱和脂肪', test: /饱和脂肪|飽和脂肪|saturated/i, kind: 'g' },
  { word: '反式脂肪', test: /反式脂肪|\btrans\b/i, kind: 'g' },
  { word: '碳水化合物', test: /碳水化合物|碳水|carbohydrate|\bcarbs?\b/i, kind: 'g' },
  { word: '纤维', test: /纤维|纖維|\bfiber\b/i, kind: 'g' },
  { word: '糖', test: /糖|sugars?/i, reject: /碳水|血糖|糖醇|carbohydrate/i, kind: 'g' },
  { word: '钠', test: /钠|鈉|\bsodium\b/i, reject: /亚硝酸|亞硝酸/i, kind: 'mg' },
  { word: '钙', test: /钙|鈣|\bcalcium\b/i, kind: 'mg' },
]

function place(item) {
  const xs = item.box.map((point) => point[0])
  const ys = item.box.map((point) => point[1])
  const top = Math.min(...ys)
  return {
    text: String(item.text || '').replace(/\s+/g, ' ').trim(),
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (top + Math.max(...ys)) / 2,
  }
}

function keysIn(text) {
  const found = []
  let rest = text
  for (const [word, id] of KEYS) {
    if (rest.includes(word) && !found.some((item) => item.id === id)) {
      found.push({ word, id, at: text.indexOf(word) })
      rest = rest.replace(word, ' ')
    }
  }
  return found.sort((a, b) => a.at - b.at)
}

function valueKind(text) {
  const clean = cleanValue(text)
  if (/毫克|(?:^|[^a-z])mg(?:$|[^a-z])/i.test(clean)) return 'mg'
  if (/kj|千/i.test(clean)) return 'energy'
  if (/克|(?:\d|^)\s*g(?:$|[^a-z])|\bog\b/i.test(clean)) return 'g'
  if (/^\d+[:.]\d+/.test(clean)) return 'g'
  return ''
}

function isValue(text) {
  if (/每\s*100|nrv|per\s*100|项目|items/i.test(text)) return false
  if (keysIn(text).length) return false
  return Boolean(valueKind(text))
}

function cleanValue(text) {
  const cleaned = text
    .replace(/\bog\b/gi, '0g')
    .replace(/(\d):(\d)/g, '$1.$2')
    .replace(/\d+(?:\.\d+)?\s*%/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (/^(?:0g|0克)$/i.test(cleaned)) return '0g'
  return cleaned
}

const KEY_KIND = {
  energy: 'energy',
  protein: 'g',
  fat: 'g',
  saturated: 'g',
  trans: 'g',
  carbs: 'g',
  fiber: 'g',
  sugar: 'g',
  sodium: 'mg',
  calcium: 'mg',
  iron: 'mg',
  zinc: 'mg',
}

function amountText(labelText, valueText) {
  let cleaned = cleanValue(valueText || '')
  if (/^g$/i.test(cleaned)) return /0\s*%/.test(labelText) ? '0g' : ''
  if (/^\d+(?:\.\d+)?号$/.test(cleaned)) cleaned = cleaned.replace(/号$/, 'g')
  else if (/^\d+(?:\.\d+)?$/.test(cleaned)) cleaned = `${cleaned}g`
  return cleaned
}

function pairedLines(items) {
  const values = items.filter((item) => isValue(item.text))
  const labels = items.filter((item) => keysIn(item.text).length && item.text.length <= 48)
  const usedValues = new Set()
  const rows = []
  function take(label, kind) {
    const matches = values.filter((value) => !usedValues.has(value)
      && value.x + 40 >= label.x
      && Math.abs(value.y - label.y) < 150
      && valueKind(value.text) === kind)
    matches.sort((a, b) => Math.abs(a.y - label.y) - Math.abs(b.y - label.y) || a.y - b.y)
    return matches[0] || null
  }
  for (const label of labels.sort((a, b) => a.y - b.y)) {
    const keys = keysIn(label.text)
    const own = label.text.match(/(?:\d+(?:\.\d+)?|og)\s*(?:kj|千焦|千卡|千素|千|k\b|毫克|mg|克|g)/i)
    keys.forEach((key, index) => {
      const value = own && index === 0 ? null : take(label, KEY_KIND[key.id])
      const amount = own && index === 0 ? cleanValue(own[0]) : amountText(label.text, value?.text || '')
      if (value && amount) usedValues.add(value)
      if (amount) rows.push(`${key.word} ${amount}`.trim())
    })
  }
  return rows
}

function prepareLine(text) {
  return text
    .replace(/\bog\b/gi, '0g')
    .replace(/(\d):(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function measuresIn(line, kind) {
  const clean = prepareLine(line).replace(/\d+(?:\.\d+)?\s*%/g, ' ')
  const found = []
  const pattern = /(\d+(?:\.\d+)?)\s*(千卡|大卡|kcal|千焦|千焦尔|千素|千|kj|j|毫克|mg|克|g)/gi
  for (const match of clean.matchAll(pattern)) {
    let unit = match[2].toLowerCase()
    if (unit === '千' || unit === '千素' || unit === 'j') unit = '千焦'
    if (unit === 'kj') unit = '千焦'
    if (unit === 'kcal') unit = '千卡'
    const energy = unit === '千焦' || unit === '千卡' || unit === '大卡'
    const mg = unit === '毫克' || unit === 'mg'
    const gram = unit === '克' || unit === 'g'
    if (kind === 'energy' && !energy) continue
    if (kind === 'g' && !gram) continue
    if (kind === 'mg' && !mg && !gram) continue
    found.push({ raw: match[1], unit })
  }
  if (kind === 'energy') {
    const kcal = found.filter((item) => item.unit === '千卡' || item.unit === '大卡')
    if (kcal.length) return kcal
  }
  if (kind === 'mg') {
    const mg = found.filter((item) => item.unit === '毫克' || item.unit === 'mg')
    if (mg.length) return mg
  }
  return found
}

function choose(measures) {
  if (!measures.length) return null
  const dotted = measures.filter((item) => item.raw.includes('.'))
  const plain = measures.filter((item) => !item.raw.includes('.'))
  for (const item of dotted) {
    const digits = item.raw.replace('.', '').replace(/^0+/, '')
    if (plain.some((other) => other.raw.replace(/^0+/, '') === digits)) return item
  }
  let best = measures[0]
  for (const item of measures.slice(1)) {
    const a = best.raw
    const b = item.raw
    if (a !== b && (a.startsWith(b) || b.startsWith(a)) && b.length > a.length) best = item
  }
  return best
}

function fieldMeasures(lines, field) {
  const measures = []
  const mixed = []
  for (const line of lines) {
    if (!line || line.length > 80) continue
    if (field.reject && field.reject.test(line)) continue
    if (!field.test.test(line)) continue
    const shared = FIELDS.some((other) => other.word !== field.word && other.test.test(line) && !(other.reject && other.reject.test(line)))
    const found = measuresIn(line, field.kind)
    if (shared) mixed.push(...found)
    else measures.push(...found)
  }
  return choose(measures.length ? measures : mixed)
}

function emitField(field, measure) {
  if (!measure) return ''
  if (field.kind === 'energy') {
    const unit = measure.unit === '千卡' || measure.unit === '大卡' ? '千卡' : '千焦'
    return `${field.word} ${measure.raw}${unit}`
  }
  if (measure.unit === '毫克' || measure.unit === 'mg') return `${field.word} ${measure.raw}毫克`
  return `${field.word} ${measure.raw}克`
}

function pickName(lines) {
  let best = ''
  for (const line of lines) {
    const text = prepareLine(line)
    if (!text || text.length > 40 || /[\u4e00-\u9fff]/.test(text)) continue
    if (/nutrition|information|serving|energy|protein|sodium|fat|carb|item|per\s*100|^\d/i.test(text)) continue
    if (/^[A-Z]{2,6}$/.test(text)) continue
    if (!(text.includes(' ') || text.length >= 8)) continue
    if (!/[A-Za-z]{3}/.test(text)) continue
    if (text.length > best.length) best = text
  }
  return best
}

function buildText(lines) {
  const blob = lines.join('\n')
  const perMl = /每\s*100\s*(?:毫升|m+l)|per\s*100\s*m+l/i.test(blob)
  const perG = /每\s*100\s*(?:克|g)|per\s*100\s*g/i.test(blob)
  const net = blob.match(/净含量\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:克|g)/i)
  const out = []
  const name = pickName(lines)
  if (name) out.push(name)
  out.push('营养成分表')
  if (perMl) out.push('每100毫升')
  else if (perG) out.push('每100克')
  if (net) out.push(`净含量：${net[1]}克`)
  for (const field of FIELDS) {
    const line = emitField(field, fieldMeasures(lines, field))
    if (line) out.push(line)
  }
  return `${out.join('\n')}\n`
}

async function detect(ocr, transform) {
  const prepared = path.join(os.tmpdir(), `daily-plate-${Date.now()}-${Math.random().toString(16).slice(2)}.png`)
  await transform.png().toFile(prepared)
  try {
    const result = await ocr.detect(prepared)
    return (result.texts || []).filter((item) => item && String(item.text || '').trim() && Array.isArray(item.box))
  } finally {
    fs.rmSync(prepared, { force: true })
  }
}

async function isDark(source) {
  const { channels } = await sharp(source).rotate().grayscale().stats()
  return channels[0].mean < 110
}

const base = () => sharp(file).rotate().resize({ width: 2200, withoutEnlargement: false }).grayscale().normalise()
const ocr = await Ocr.create()
const plainRaw = await detect(ocr, base())
const sharpRaw = await detect(ocr, base().sharpen())
const passes = [plainRaw, sharpRaw]
if (await isDark(file)) passes.push(await detect(ocr, base().negate()))

const candidates = []
for (const raw of passes) {
  const rows = groupRows(raw)
  if (rows.length) candidates.push(rows.join('\n'))
}
const plain = plainRaw.map(place)
const sharpItems = sharpRaw.map(place)
const lines = [
  ...plain.map((item) => item.text),
  ...sharpItems.map((item) => item.text),
  ...pairedLines(plain),
  ...pairedLines(sharpItems),
]
if (process.env.DEBUG_OCR) {
  for (const item of plain) process.stderr.write(`${Math.round(item.y)} ${item.text}\n`)
}
candidates.push(buildText(lines))
process.stdout.write(JSON.stringify({ candidates }))
