import { addDays } from './dates.js'
import { kgToLb, lbToKg } from './units.js'

export function repRange(targetReps) {
  const text = String(targetReps || '').trim()
  const range = text.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return { low: Number(range[1]), high: Number(range[2]) }
  const single = text.match(/^(\d+)$/)
  if (single) return { low: Number(single[1]), high: Number(single[1]) }
  return null
}

// Double progression: once every working set reaches the top of the range,
// add the smallest normal plate jump for the next session.
export function nextLoad(sets, targetReps, units) {
  const match = String(targetReps || '').match(/(\d+)\s*-\s*(\d+)/)
  if (!match || !sets?.length) return null
  const high = Number(match[2])
  const working = sets.filter((set) => set.reps > 0 && set.weightKg > 0)
  if (!working.length || !working.every((set) => set.reps >= high)) return null
  const top = Math.max(...working.map((set) => set.weightKg))
  if (units === 'imperial') return lbToKg(Math.round(kgToLb(top) + 5))
  return Math.round((top + 2.5) * 10) / 10
}

export function bestSet(sets) {
  let best = null
  for (const set of sets || []) {
    if (!(set.weightKg > 0) || !(set.reps > 0)) continue
    if (!best || set.weightKg > best.weightKg || (set.weightKg === best.weightKg && set.reps > best.reps)) best = set
  }
  return best
}

function newestFirst(sessions) {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date) || String(b.startedAt).localeCompare(String(a.startedAt)))
}

export function previousSets(sessions, exerciseId, beforeDate, excludeId) {
  for (const session of newestFirst(sessions)) {
    if (session.date > beforeDate || session.id === excludeId) continue
    const exercise = session.exercises.find((item) => item.exerciseId === exerciseId)
    const sets = exercise?.sets?.filter((set) => set.reps > 0) || []
    if (sets.length) return sets
  }
  return []
}

export function sessionVolume(session) {
  let volume = 0
  for (const exercise of session.exercises || []) {
    for (const set of exercise.sets || []) {
      if (set.weightKg > 0 && set.reps > 0) volume += set.weightKg * set.reps
    }
  }
  return volume
}

export function sessionSetCount(session) {
  return (session.exercises || []).reduce((sum, exercise) => sum + (exercise.sets || []).filter((set) => set.reps > 0).length, 0)
}

export function epley(weightKg, reps) {
  if (!(weightKg > 0) || reps < 1 || reps > 12) return null
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function rollingAverage(points) {
  return points.map((point) => {
    const start = addDays(point.date, -6)
    const window = points.filter((item) => item.date >= start && item.date <= point.date)
    const avg = window.reduce((sum, item) => sum + item.kg, 0) / window.length
    return Math.round(avg * 10) / 10
  })
}

function bestOf(sets) {
  let weight = null
  let e1rm = null
  let reps = null
  for (const set of sets || []) {
    if (!(set.reps > 0)) continue
    if (set.weightKg > 0) {
      if (!weight || set.weightKg > weight.weightKg || (set.weightKg === weight.weightKg && set.reps > weight.reps)) weight = set
      const estimate = epley(set.weightKg, set.reps)
      if (estimate && (!e1rm || estimate > e1rm.value)) e1rm = { value: estimate, set }
    } else if (!reps || set.reps > reps.reps) {
      reps = set
    }
  }
  return { weight, e1rm, reps }
}

// Best lifts per exercise across every finished session.
export function personalRecords(sessions) {
  const records = new Map()
  for (const session of sessions) {
    for (const exercise of session.exercises || []) {
      const found = bestOf(exercise.sets)
      const current = records.get(exercise.exerciseId) || { exerciseId: exercise.exerciseId }
      if (found.weight && (!current.weight || found.weight.weightKg > current.weight.weightKg
        || (found.weight.weightKg === current.weight.weightKg && found.weight.reps > current.weight.reps))) {
        current.weight = { ...found.weight, date: session.date }
      }
      if (found.e1rm && (!current.e1rm || found.e1rm.value > current.e1rm.value)) {
        current.e1rm = { value: found.e1rm.value, set: found.e1rm.set, date: session.date }
      }
      if (found.reps && (!current.reps || found.reps.reps > current.reps.reps)) {
        current.reps = { ...found.reps, date: session.date }
      }
      records.set(exercise.exerciseId, current)
    }
  }
  return records
}

// Records the given session beats, compared with every other session.
export function recordsSetBy(session, sessions) {
  const others = sessions.filter((item) => item.id !== session.id)
  const before = personalRecords(others)
  const out = []
  for (const exercise of session.exercises || []) {
    const found = bestOf(exercise.sets)
    const prior = before.get(exercise.exerciseId)
    if (!prior) continue
    if (found.weight && prior.weight && found.weight.weightKg > prior.weight.weightKg) {
      out.push({ exerciseId: exercise.exerciseId, kind: 'weight', set: found.weight })
    } else if (found.e1rm && prior.e1rm && found.e1rm.value > prior.e1rm.value + 0.05) {
      out.push({ exerciseId: exercise.exerciseId, kind: 'e1rm', set: found.e1rm.set, value: found.e1rm.value })
    } else if (found.reps && prior.reps && !found.weight && found.reps.reps > prior.reps.reps) {
      out.push({ exerciseId: exercise.exerciseId, kind: 'reps', set: found.reps })
    }
  }
  return out
}

export function exerciseHistory(sessions, exerciseId) {
  return newestFirst(sessions)
    .map((session) => {
      const exercise = session.exercises.find((item) => item.exerciseId === exerciseId)
      if (!exercise) return null
      const sets = exercise.sets.filter((set) => set.reps > 0)
      if (!sets.length) return null
      return { sessionId: session.id, date: session.date, name: session.name, sets }
    })
    .filter(Boolean)
}

export function setsByGroup(sessions, lookup) {
  const totals = new Map()
  for (const session of sessions) {
    for (const exercise of session.exercises || []) {
      const info = lookup(exercise.exerciseId)
      if (!info) continue
      const count = (exercise.sets || []).filter((set) => set.reps > 0).length
      totals.set(info.primary, (totals.get(info.primary) || 0) + count)
    }
  }
  return [...totals.entries()].map(([group, sets]) => ({ group, sets })).sort((a, b) => b.sets - a.sets)
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
