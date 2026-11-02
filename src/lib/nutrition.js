export const meals = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
]

export const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium']

export function nutritionFor(per100, grams) {
  const factor = grams / 100
  const out = {}
  for (const key of nutrientKeys) out[key] = (per100[key] || 0) * factor
  return out
}

export function sumNutrition(items) {
  const totals = Object.fromEntries(nutrientKeys.map((key) => [key, 0]))
  for (const item of items || []) {
    for (const key of nutrientKeys) totals[key] += Number(item[key]) || 0
  }
  return totals
}

export function roundKcal(value) {
  return Math.round(Number(value) || 0)
}

export function roundMacro(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function foodById(foods, id) {
  return foods.find((food) => food.id === id) || null
}

export function cjkAlias(food) {
  return food.aliases?.find((alias) => /[\u4e00-\u9fff]/.test(alias)) || ''
}
