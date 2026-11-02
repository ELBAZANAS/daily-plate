const volumeMl = {
  ml: 1,
  l: 1000,
  floz: 29.5735295625,
  cup: 240,
  tbsp: 15,
  tsp: 5,
}

const massG = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
}

export const amountUnits = [
  ['g', 'grams'],
  ['ml', 'millilitres'],
  ['oz', 'ounces'],
  ['cup', 'cups'],
  ['tbsp', 'tablespoons'],
  ['tsp', 'teaspoons'],
]

const unitNames = new Set(amountUnits.map(([id]) => id))

export function sliderFor(unit) {
  if (unit === 'serving') return { min: 0, max: 8, step: 0.25 }
  if (unit === 'oz') return { min: 0, max: 16, step: 0.1 }
  if (unit === 'cup') return { min: 0, max: 4, step: 0.05 }
  if (unit === 'tbsp' || unit === 'tsp') return { min: 0, max: 8, step: 0.5 }
  return { min: 0, max: 500, step: 1 }
}

export function gramsFrom(food, amount, unit, servingGrams = 100) {
  const value = Number(amount)
  if (!(value > 0)) return 0
  if (unit === 'serving') return value * servingGrams
  if (volumeMl[unit]) return value * volumeMl[unit] * (food?.density > 0 ? food.density : 1)
  if (massG[unit]) return value * massG[unit]
  return 0
}

export function isVolumeUnit(unit) {
  return Boolean(volumeMl[unit])
}

export function amountFromGrams(food, grams, unit, servingGrams = 100) {
  if (!(grams > 0)) return 0
  if (unit === 'serving') return grams / servingGrams
  if (volumeMl[unit]) return grams / (volumeMl[unit] * (food?.density > 0 ? food.density : 1))
  if (massG[unit]) return grams / massG[unit]
  return grams
}

export function formatAmount(value) {
  if (!Number.isFinite(value)) return ''
  return String(Math.round(value * 100) / 100)
}

export function formatPortion(item) {
  if (item.quick) return 'Quick add'
  if (unitNames.has(item.servingLabel) && item.servingLabel !== 'g') {
    return `${formatAmount(item.quantity)} ${item.servingLabel} · ${formatAmount(item.grams)} g`
  }
  return `${formatAmount(item.grams)} g`
}
