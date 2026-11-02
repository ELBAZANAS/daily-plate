export function formatKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(d = new Date()) {
  return formatKey(d)
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key, n) {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return formatKey(d)
}

export function weekday(key) {
  return parseKey(key).getDay()
}

export function weekStart(key) {
  const d = parseKey(key)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return formatKey(d)
}

export function prettyDate(key, options) {
  return new Intl.DateTimeFormat(undefined, options || {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parseKey(key))
}

export function monthMatrix(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const startOffset = (first.getDay() + 6) % 7
  const start = new Date(year, monthIndex, 1 - startOffset)
  const weeks = []
  for (let w = 0; w < 6; w += 1) {
    const week = []
    let inMonth = false
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + i)
      if (date.getMonth() === monthIndex) inMonth = true
      week.push(formatKey(date))
    }
    if (inMonth) weeks.push(week)
  }
  return weeks
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function mealForNow(date = new Date()) {
  const h = date.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
