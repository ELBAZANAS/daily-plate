function toAsciiDigits(value) {
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

export function normalizeLabelText(raw) {
  let text = String(raw || '').replace(/\r/g, '')
  text = toAsciiDigits(text)
  text = text.replace(/[Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  text = text.replace(/：/g, ':').replace(/％/g, '%').replace(/．/g, '.').replace(/。/g, '.')
  text = text.replace(/([\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])/g, '$1')
  text = text.replace(/[Il|][O0][O0](?=\s*m+l)/gi, '100')
  // OCR often drops spaces: "TotalFat7g" -> "Total Fat 7g".
  text = text.replace(/([a-z])([A-Z][a-z])/g, '$1 $2')
  text = text.replace(/([A-Za-z])(\d)/g, '$1 $2')
  return text
}

function linesOf(text) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

function withoutPercents(line) {
  return String(line || '').replace(/\d+(?:\.\d+)?\s*%/g, ' ')
}

function kjToKcal(value) {
  return Math.round(Number(value) / 4.184)
}

const ROWS = [
  { id: 'energy', label: 'Energy', test: /能量|热量|熱量|\benergy\b|\bcalories\b/i },
  { id: 'protein', label: 'Protein', test: /蛋白质|蛋白質|蛋白|白质|\bprotein\b/i },
  { id: 'fat', label: 'Fat', test: /脂肪|\bfat\b/i, reject: /饱和|飽和|反式|saturated|trans|calories\s*from\s*fat|from\s*fat/i },
  { id: 'saturated', label: 'Saturated fat', test: /饱和脂肪|飽和脂肪|saturated/i },
  { id: 'trans', label: 'Trans fat', test: /反式脂肪|trans/i },
  { id: 'carbs', label: 'Carbohydrate', test: /碳水化合物|carbohydrate|\bcarbs?\b/i },
  { id: 'fiber', label: 'Fiber', test: /膳食纤维|膳食纖維|纤维|纖維|dietary\s*fib(?:er|re)|\bfib(?:er|re)\b/i },
  { id: 'sugar', label: 'Sugar', test: /糖|sugars?/i, reject: /碳水|血糖|糖醇|carbohydrate/i },
  { id: 'sodium', label: 'Sodium', test: /钠|鈉|sodium/i, reject: /亚硝酸|亞硝酸/i },
  { id: 'salt', label: 'Salt', test: /\bsalt\b|食盐|食鹽/i, hidden: true },
  { id: 'calcium', label: 'Calcium', test: /钙|鈣|calcium/i },
  { id: 'iron', label: 'Iron', test: /铁|鐵|\biron\b/i },
  { id: 'zinc', label: 'Zinc', test: /锌|鋅|\bzinc\b/i },
]

const NEEDED = new Set(['energy', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium'])
const HEADER = /营养成分|營養成分|nutrition\s*(?:facts|information|info)|nutritional\s*(?:values|information)|^nutrition\b/i

// Lines that mention the nutrient, in order. A table header, when there is one, marks where
// the table starts, so a product name like "Protein Bar" or "无糖酸奶" above it is not read as a row.
// Lines that end the table: footnotes, ingredients, net contents, storage notes.
const TABLE_END = /percent daily values|daily value\s*\(?dv\)?\s*tells|daily values? (?:are|is) based|calories per gram|2,?000 calorie|配料|ingredients?\s*[:：]|^ingredients\b|净含量|淨含量|net\s*(?:wt|weight|content|contents)\b|保质期|保存期|贮存|儲存|生产日期/i
const NOT_A_ROW = /配料|ingredients?|成分\s*[:：]/i

// The table ends at the first footnote/ingredients line that comes after a nutrient row
// (net contents printed above the rows does not end it).
function tableEnd(lines, start) {
  let seenRow = false
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (seenRow && TABLE_END.test(line)) return index
    if (!NOT_A_ROW.test(line) && !TABLE_END.test(line) && ROWS.some((row) => row.test.test(line))) seenRow = true
  }
  return lines.length
}

// Lines that mention the nutrient, in order, between `start` and `end`.
function rowLines(lines, row, start, end = lines.length) {
  const out = []
  for (let index = start; index < end; index += 1) {
    const line = lines[index]
    if (NOT_A_ROW.test(line)) continue
    if (row.test.test(line) && !(row.reject && row.reject.test(line))) out.push(index)
  }
  return out
}

const UNIT_PATTERN = /(\d+(?:\.\d+)?)\s*(千卡|大卡|kcal|千焦|千焦尔|千素|千|kj|j|毫克|mg|克|g|毫升|ml)(?![a-z])/gi

function unitOf(raw) {
  let unit = raw.toLowerCase()
  if (unit === '千' || unit === '千素' || unit === 'j' || unit === 'kj') unit = '千焦'
  if (unit === 'kcal' || unit === '大卡') unit = '千卡'
  return unit
}

// Every "number + unit" on a line. `column` picks the per-100 column on two-column labels;
// `preferKcal` keeps the kilocalorie figure when a line gives both kJ and kcal.
function measure(text, { column = 0, preferKcal = false } = {}) {
  const clean = withoutPercents(text)
  const all = [...clean.matchAll(UNIT_PATTERN)].map((match) => ({ value: Number(match[1]), unit: unitOf(match[2]), dotted: match[1].includes('.') }))
  if (!all.length) return null
  if (preferKcal) {
    // Prefer kcal; on a two-column line where only one column prints kcal, take kJ from the right column.
    const kcal = all.filter((item) => item.unit === '千卡')
    const kj = all.filter((item) => item.unit === '千焦')
    if (kcal.length > column) return kcal[column]
    if (kj.length > column) return kj[column]
    if (kcal.length) return kcal[kcal.length - 1]
  }
  return all[Math.min(column, all.length - 1)]
}

function bareNumbers(text) {
  return [...withoutPercents(text).matchAll(/(\d+(?:\.\d+)?)/g)].map((item) => item[1])
}

function readLine(lines, index, row, options) {
  const line = lines[index]
  const energy = row.id === 'energy'
  const opts = { ...options, preferKcal: energy }
  const onLine = measure(line, opts)
  if (onLine) return onLine
  if (energy && /calories/i.test(line)) {
    const bare = bareNumbers(line)
    if (bare.length) return { value: Number(bare[Math.min(options.column, bare.length - 1)]), unit: '千卡', dotted: bare[0].includes('.') }
  }
  const nextLine = lines[index + 1] || ''
  const nextIsNutrient = ROWS.some((other) => other.test.test(nextLine))
  if (!nextIsNutrient) {
    const next = measure(nextLine, opts)
    if (next) return next
  }
  const own = nextIsNutrient ? line : `${line} ${nextLine}`
  // "Calories" with its number on the next line.
  if (energy && /calories/i.test(line)) {
    const bare = bareNumbers(own)
    if (bare.length) return { value: Number(bare[0]), unit: '千卡', dotted: bare[0].includes('.') }
  }
  if (energy && /能量|热量|熱量|energy/i.test(line) && !/千卡|大卡|kcal/i.test(own)) {
    const bare = bareNumbers(own)
    const unit = /kcal|千卡|大卡/i.test(line) ? '千卡' : '千焦'
    if (bare.length) return { value: Number(bare[Math.min(options.column, bare.length - 1)]), unit, dotted: bare[0].includes('.') }
  }
  // The unit is printed in the row name, e.g. "钠(mg) 370" or "Sodium (mg) 370".
  if (MINERALS.has(row.id)) {
    const named = line.match(/[(（]\s*(mg|毫克|g|克)\s*[)）]/i)
    const numbers = bareNumbers(line.replace(/[(（][^)）]*[)）]/g, ' '))
    if (named && numbers.length) return { value: Number(numbers[Math.min(options.column, numbers.length - 1)]), unit: unitOf(named[1]), dotted: numbers[0].includes('.') }
    return null
  }
  if (!energy) {
    const numbers = bareNumbers(line.replace(/[(（]\s*(?:g|克)\s*[)）]/gi, ' '))
    const decimal = numbers.find((value) => value.includes('.'))
    const raw = options.column > 0 && numbers.length > options.column ? numbers[options.column] : decimal != null ? decimal : numbers[0]
    if (raw != null && Number(raw) <= 100) return { value: Number(raw), unit: 'g', dotted: raw.includes('.') }
  }
  return null
}

function readRow(lines, row, options) {
  for (const index of rowLines(lines, row, options.start, options.end)) {
    const found = readLine(lines, index, row, options)
    if (found) return found
  }
  return null
}

const MINERALS = new Set(['sodium', 'calcium', 'iron', 'zinc'])

function asGramsOrMg(found, kind) {
  if (!found) return null
  const unit = found.unit
  if (kind === 'salt-grams') {
    if (unit === '克' || unit === 'g') return found.value
    if (unit === '毫克' || unit === 'mg') return Math.round(found.value) / 1000
    return null
  }
  if (MINERALS.has(kind)) {
    if (unit === '毫克' || unit === 'mg') return found.value
    if ((unit === '克' || unit === 'g') && found.value < 20) return Math.round(found.value * 1000)
    return null
  }
  if (unit === '克' || unit === 'g') return found.value
  return null
}

function gramItem(item) {
  if (!item || (item.unit !== '克' && item.unit !== 'g')) return null
  return item
}

function shiftDecimal(item) {
  item.value = Math.round(item.value * 10) / 100
  item.dotted = true
}

function repairPer100(found, per100, kcal, notes) {
  if (!per100) return
  const gramIds = ['protein', 'fat', 'saturated', 'trans', 'carbs', 'fiber', 'sugar']
  const changes = []
  const remember = (id, before) => {
    const row = ROWS.find((item) => item.id === id)
    if (!row) return
    changes.push({ label: row.label, before, after: found[id].value })
  }
  for (const id of gramIds) {
    const item = gramItem(found[id])
    if (!item || item.dotted) continue
    if (item.value <= 100) continue
    const before = item.value
    while (item.value > 100) shiftDecimal(item)
    remember(id, before)
  }
  if (kcal > 0) {
    for (let guard = 0; guard < 4; guard += 1) {
      const present = ['protein', 'carbs', 'fat'].map((id) => gramItem(found[id])).filter(Boolean)
      if (present.length < 2) break
      const sum = (gramItem(found.protein)?.value || 0) * 4
        + (gramItem(found.carbs)?.value || 0) * 4
        + (gramItem(found.fat)?.value || 0) * 9
      if (sum <= kcal * 1.3 + 30) break
      const candidates = ['protein', 'fat', 'carbs']
        .map((id) => gramItem(found[id]))
        .filter((item) => item && !item.dotted && item.value >= 10)
        .sort((a, b) => b.value - a.value)
      if (!candidates.length) break
      const item = candidates[0]
      const id = gramIds.find((key) => found[key] === item)
      const before = item.value
      shiftDecimal(item)
      remember(id, before)
    }
  }
  if (changes.length) {
    for (const id of ['fiber', 'sugar']) {
      const item = gramItem(found[id])
      if (!item || item.dotted || item.value < 10) continue
      const carbs = gramItem(found.carbs)?.value
      if (carbs != null && item.value / 10 > carbs + 0.05) continue
      const before = item.value
      shiftDecimal(item)
      remember(id, before)
    }
    const parts = changes.map((change) => `${change.label} ${change.before} g was read as ${change.after} g`)
    notes.push(`A faint decimal point was restored: ${parts.join(', ')}.`)
  }
}

function energyKcal(found, notes) {
  if (!found) return null
  if (found.unit === '千卡' || found.unit === '大卡' || found.unit === 'kcal') return Math.round(found.value)
  if (found.unit === '千焦' || found.unit === '千焦尔' || found.unit === 'kj' || found.unit === 'j') {
    notes.push('Energy was listed in kilojoules and converted to calories.')
    return kjToKcal(found.value)
  }
  return null
}

function energyDetail(found, kcal) {
  if (!found || kcal == null) return 'Not on the label'
  if (found.unit === '千焦' || found.unit === '千焦尔' || found.unit === 'kj' || found.unit === 'j') {
    return `${found.value} kJ, saved as ${kcal} kcal`
  }
  return `${kcal} kcal`
}

function amountDetail(found, kind) {
  if (!found) return 'Not on the label'
  if (MINERALS.has(kind)) {
    const mg = asGramsOrMg(found, kind)
    return mg == null ? 'Not on the label' : `${mg} mg`
  }
  const grams = asGramsOrMg(found, kind)
  return grams == null ? 'Not on the label' : `${grams} g`
}

function englishName(lines) {
  const index = lines.findIndex((line) => /营养成分|nutrition/i.test(line))
  const pool = []
  if (index > 0) pool.push(lines[index - 1], lines[index - 2] || '')
  pool.push(...lines.slice(0, 8))
  for (const line of pool) {
    if (!line || /[\u4e00-\u9fff]/.test(line) || line.length > 40) continue
    if (/nutrition|information|serving|per\s*100|items|^\d/i.test(line)) continue
    if (/calorie|energy|protein|\bfat\b|carbohydrate|sugar|fib(?:er|re)|sodium|salt|cholesterol|vitamin|calcium|iron|potassium|daily value|ingredients|\d+\s*(?:g|mg|kj|kcal)\b/i.test(line)) continue
    if (/^[A-Z]{2,6}$/.test(line)) continue
    if (!(line.includes(' ') || line.length >= 8)) continue
    if (/[A-Za-z]{3}/.test(line)) return line
  }
  return ''
}

export function parseNutritionLabel(raw) {
  const text = normalizeLabelText(raw)
  const lines = linesOf(text)
  const notes = []
  const found = {}
  const header = lines.findIndex((line) => HEADER.test(line))
  // Two-column tables ("per serving | per 100 g") keep the per-100 g column.
  const columns = lines.find((line) => /(?:per|每)\s*100/i.test(line) && /(?:per\s*serv|每份|每\s*份)/i.test(line))
  let column = 0
  if (columns) {
    const at100 = columns.search(/(?:per|每)\s*100/i)
    const atServing = columns.search(/(?:per\s*serv|每份|每\s*份)/i)
    column = at100 > atServing ? 1 : 0
  }
  // The header marks where the table starts when the nutrient rows follow it (a product name
  // like "Protein Bar" above it is then ignored). A header with no rows after it is ignored.
  const rowsAfter = (from) => lines.slice(from + 1).filter((line) => !NOT_A_ROW.test(line) && ROWS.some((row) => row.test.test(line))).length
  const start = header >= 0 && rowsAfter(header) >= 2 ? header : 0
  const options = { start, end: tableEnd(lines, start), column }
  for (const row of ROWS) found[row.id] = readRow(lines, row, options)
  if (asGramsOrMg(found.sodium, 'sodium') == null && found.salt) {
    const salt = asGramsOrMg({ ...found.salt, unit: found.salt.unit === '毫克' ? 'mg' : found.salt.unit }, 'salt-grams')
    if (salt != null && salt <= 100) {
      found.sodium = { value: Math.round(salt * 400), unit: 'mg', dotted: false }
      notes.push(`Salt ${salt} g was converted to ${found.sodium.value} mg sodium.`)
    }
  }
  if (columns) notes.push('This label has a per-serving and a per-100 g column. The per-100 g numbers were used.')

  const per100ml = /每\s*100\s*(?:毫升|m+l)|per\s*100\s*m+l|100\s*m+l/i.test(text)
  const per100 = per100ml || Boolean(columns) || /每\s*100\s*(?:克|g)|per\s*100\s*g/i.test(text)
  if (per100ml) notes.push('This label is per 100 ml. Drinks this close to water are saved as 100 g.')

  const servingMatch = text.match(/serving size[^\d]{0,24}(\d+(?:\.\d+)?)\s*(g|ml)/i)
    || text.match(/每份[^\d]{0,16}(\d+(?:\.\d+)?)\s*(克|毫升|g|ml)/i)
    || text.match(/\((\d+(?:\.\d+)?)\s*(g|ml|克|毫升)\)/i)
  const netMatch = text.match(/净含量\s*:?\s*(\d+(?:\.\d+)?)\s*(克|毫升|g|ml)/i)
    || text.match(/net(?:\s*wt\.?|\s*weight|\s*content)?\s*:?\s*(\d+(?:\.\d+)?)\s*(g|ml)/i)

  let servingGrams = null
  if (servingMatch && !per100) servingGrams = Number(servingMatch[1])
  else if (per100) servingGrams = 100

  const kcal = energyKcal(found.energy, notes)
  repairPer100(found, per100, kcal, notes)
  const facts = []
  facts.push({ label: 'Basis', detail: per100ml ? 'Per 100 ml' : per100 ? 'Per 100 g' : servingGrams ? `Per serving, ${servingGrams} g` : 'Serving size was not found' })
  if (netMatch) facts.push({ label: 'Net contents', detail: `${netMatch[1]} ${/毫升|ml/i.test(netMatch[2]) ? 'ml' : 'g'}` })
  facts.push({ label: 'Energy', detail: energyDetail(found.energy, kcal) })
  for (const row of ROWS) {
    if (row.id === 'energy' || row.hidden) continue
    const detail = amountDetail(found[row.id], row.id)
    if (!NEEDED.has(row.id) && detail === 'Not on the label') continue
    facts.push({ label: row.label, detail })
  }

  return {
    text,
    name: englishName(lines),
    per100,
    per100ml,
    servingGrams,
    kcal,
    protein: asGramsOrMg(found.protein, 'protein'),
    fat: asGramsOrMg(found.fat, 'fat'),
    carbs: asGramsOrMg(found.carbs, 'carbs'),
    fiber: asGramsOrMg(found.fiber, 'fiber'),
    sugar: asGramsOrMg(found.sugar, 'sugar'),
    sodium: asGramsOrMg(found.sodium, 'sodium'),
    facts,
    notes,
  }
}

export function macroWarning(kcal, protein, carbs, fat) {
  const fromMacros = protein * 4 + carbs * 4 + fat * 9
  if (!(kcal > 0)) return null
  const diff = Math.abs(fromMacros - kcal)
  if (diff / kcal > 0.25 && diff > 30) {
    return `Protein, carbs, and fat add up to about ${Math.round(fromMacros)} kcal, while calories say ${Math.round(kcal)}. Labels can differ because of fiber and rounding — check the package once more.`
  }
  return null
}

export function readingScore(parsed) {
  if (!parsed) return 0
  let score = 0
  if (parsed.kcal != null) score += 5
  if (parsed.protein != null) score += 3
  if (parsed.carbs != null) score += 3
  if (parsed.fat != null) score += 2
  if (parsed.fiber != null) score += 1
  if (parsed.sugar != null) score += 1
  if (parsed.sodium != null) score += 1
  if (parsed.per100 || parsed.servingGrams) score += 2
  if (parsed.kcal > 0 && parsed.protein != null && parsed.carbs != null && parsed.fat != null) {
    const fromMacros = parsed.protein * 4 + parsed.carbs * 4 + parsed.fat * 9
    const diff = Math.abs(fromMacros - parsed.kcal) / parsed.kcal
    if (diff < 0.2) score += 3
    else if (diff > 0.5) score -= 3
  }
  return score
}

// The label reader can return several readings of one photo. Keep the one
// whose numbers are most complete and agree best with each other.
export function bestReading(texts) {
  let best = { text: '', parsed: parseNutritionLabel(''), score: -Infinity }
  for (const text of texts || []) {
    if (!String(text || '').trim()) continue
    const parsed = parseNutritionLabel(text)
    const score = readingScore(parsed)
    if (score > best.score) best = { text, parsed, score }
  }
  return best
}

// Desktop reader output: either plain text (older reader) or JSON with candidates.
export function readerTexts(output) {
  const raw = String(output || '').trim()
  if (raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw)
      if (Array.isArray(data.candidates)) return data.candidates.map(String)
    } catch {
      // fall through to plain text
    }
  }
  return [raw]
}
