import catalog from './exercise-catalog.json' with { type: 'json' }

const bodyLabels = {
  back: 'Back',
  cardio: 'Cardio',
  chest: 'Chest',
  'lower arms': 'Forearms',
  'lower legs': 'Calves',
  neck: 'Neck',
  shoulders: 'Shoulders',
  'upper arms': 'Arms',
  'upper legs': 'Legs',
  waist: 'Core',
}

export const muscleGroups = ['Chest', 'Back', 'Shoulders', 'Arms', 'Forearms', 'Legs', 'Calves', 'Core', 'Cardio', 'Neck']

export const groupColors = {
  Chest: '#d9734e',
  Back: '#4f7ec9',
  Shoulders: '#8a6cc4',
  Arms: '#c95a73',
  Forearms: '#b8743a',
  Legs: '#3f9a73',
  Calves: '#2f8f8a',
  Core: '#c99a2e',
  Cardio: '#3b8fc0',
  Neck: '#7a8794',
}

function loggingFor(item) {
  const name = item.name.toLowerCase()
  if (item.body === 'cardio') return { logging: 'cardio', amountLabel: 'min' }
  if (/plank|wall sit|dead hang|isometric|hold\b/.test(name)) return { logging: 'strength', amountLabel: 'sec' }
  return { logging: 'strength', amountLabel: 'reps' }
}

function cleanName(name) {
  return String(name || '').replace(/в°/g, '°').replace(/\s+/g, ' ').trim()
}

export function displayName(name) {
  return cleanName(name).replace(/(^|[\s(/-])([a-z])/g, (match, lead, letter) => lead + letter.toUpperCase())
}

const assetBase = import.meta.env?.BASE_URL || '/'

export const exercises = catalog.map((item) => {
  const mode = loggingFor(item)
  const name = cleanName(item.name)
  return {
    id: item.id,
    name,
    title: displayName(name),
    primary: bodyLabels[item.body] || item.body,
    equipment: item.equipment,
    target: item.target,
    muscles: [item.target, ...(item.secondary || [])].filter((muscle, index, list) => muscle && list.indexOf(muscle) === index),
    cues: item.steps || [],
    stepsZh: item.stepsZh || [],
    image: `${assetBase}exercises/images/${item.image}`,
    gif: `${assetBase}exercises/videos/${item.gif}`,
    logging: mode.logging,
    amountLabel: mode.amountLabel,
  }
})

const counts = new Map()
for (const exercise of exercises) counts.set(exercise.equipment, (counts.get(exercise.equipment) || 0) + 1)
export const equipmentList = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)

const byId = new Map(exercises.map((item) => [item.id, item]))

export function exerciseById(id) {
  return byId.get(id) || null
}
