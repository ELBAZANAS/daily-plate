import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { foods as builtInFoods } from './data/foods.js'
import { seedPlans } from './data/plans.js'
import { planTargets } from './lib/calc.js'
import { todayKey } from './lib/dates.js'
import { newId } from './lib/nutrition.js'

// Storage keys and the saved shape match the first version of the app,
// so everything already logged keeps working.
const KEY = 'daily-plate-v2'
const DATE_KEY = 'daily-plate-date-v2'
const DRAFT_KEY = 'daily-plate-draft-v2'

const StoreContext = createContext(null)
const KNOWN_FIXES = ['2026-10-25-workouts-reset-rest-thursday']

export function defaultState() {
  return {
    version: 1,
    profile: null,
    customFoods: [],
    favorites: [],
    recentFoodIds: [],
    diary: {},
    water: {},
    weightLog: [],
    plans: seedPlans(),
    sessions: [],
    settings: { theme: 'system', fixes: [...KNOWN_FIXES] },
  }
}

function compactTargets(targets) {
  if (!targets) return null
  return {
    calories: targets.calories,
    proteinG: targets.proteinG,
    carbsG: targets.carbsG,
    fatG: targets.fatG,
    fiberG: targets.fiberG,
  }
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function normalizeState(parsed) {
  const base = defaultState()
  return {
    ...base,
    profile: isObject(parsed.profile) ? parsed.profile : null,
    customFoods: Array.isArray(parsed.customFoods) ? parsed.customFoods.filter((food) => food && food.id && food.per100) : [],
    favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    recentFoodIds: Array.isArray(parsed.recentFoodIds) ? parsed.recentFoodIds : [],
    diary: isObject(parsed.diary) ? parsed.diary : {},
    water: isObject(parsed.water) ? parsed.water : {},
    weightLog: Array.isArray(parsed.weightLog) ? parsed.weightLog.filter((entry) => entry && entry.date && entry.kg > 0) : [],
    plans: Array.isArray(parsed.plans) && parsed.plans.length ? parsed.plans : base.plans,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions.filter((session) => session && session.id && Array.isArray(session.exercises)) : [],
    settings: { ...base.settings, fixes: [], ...(isObject(parsed.settings) ? parsed.settings : {}) },
  }
}

// One-time changes the user asked for. Each runs once, then is remembered in settings.fixes.
const REST_THURSDAY = [0, 1, 2, 3, 5, 6]
const PPL_WEEKDAYS = { 'ppl-push-1': 1, 'ppl-pull-1': 2, 'ppl-legs-1': 3, 'ppl-push-2': 5, 'ppl-pull-2': 6, 'ppl-legs-2': 0 }

export function applyFixes(state) {
  const done = new Set(Array.isArray(state.settings.fixes) ? state.settings.fixes : [])
  let changed = false
  if (!done.has('2026-10-25-workouts-reset-rest-thursday')) {
    // Start workouts from zero and rest on Thursdays (Push/Pull/Legs, twice a week).
    state.sessions = []
    if (!state.plans.some((plan) => plan.id === 'ppl')) {
      const ppl = seedPlans().find((plan) => plan.id === 'ppl')
      if (ppl) state.plans.push(ppl)
    }
    const ppl = state.plans.find((plan) => plan.id === 'ppl')
    if (ppl) {
      ppl.days = ppl.days.map((day) => (PPL_WEEKDAYS[day.id] != null ? { ...day, weekday: PPL_WEEKDAYS[day.id] } : day))
      ppl.description = 'Six training days with Thursday as the rest day. Push, pull and legs, each twice a week.'
    }
    if (state.profile) {
      state.profile.workoutDays = [...REST_THURSDAY]
      state.profile.activePlanId = ppl ? 'ppl' : state.profile.activePlanId
      state.profile.trackingStart = todayKey()
    }
    done.add('2026-10-25-workouts-reset-rest-thursday')
    changed = true
  }
  state.settings = { ...state.settings, fixes: [...done] }
  return changed
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!isObject(parsed) || parsed.version !== 1) return defaultState()
    const state = normalizeState(parsed)
    if (applyFixes(state)) {
      persist(state)
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* nothing to remove */ }
    }
    return state
  } catch {
    return defaultState()
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const draft = raw ? JSON.parse(raw) : null
    return isObject(draft) && Array.isArray(draft.exercises) ? draft : null
  } catch {
    return null
  }
}

function persist(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return ''
  } catch {
    return 'This device could not save more data. Export a backup from Settings before you keep logging.'
  }
}

function upsertWeight(draft, date, kg) {
  const index = draft.weightLog.findIndex((entry) => entry.date === date)
  if (index >= 0) draft.weightLog[index] = { date, kg }
  else draft.weightLog.push({ date, kg })
  draft.weightLog.sort((a, b) => a.date.localeCompare(b.date))
}

// Days from today on use the current targets; past days keep the ones they were logged with.
function refreshTargets(draft) {
  const today = todayKey()
  const targets = compactTargets(planTargets(draft.profile))
  for (const [date, day] of Object.entries(draft.diary)) {
    if (date >= today && day) day.targets = targets
  }
}

// The profile weight follows the newest weigh-in that is not in the future.
function syncProfileWeight(draft) {
  if (!draft.profile) return
  const today = todayKey()
  const latest = [...draft.weightLog].reverse().find((entry) => entry.date <= today)
  if (latest && draft.profile.weightKg !== latest.kg) {
    draft.profile.weightKg = latest.kg
    refreshTargets(draft)
  }
}

function ensureDay(draft, date) {
  if (!draft.diary[date]) {
    draft.diary[date] = { items: [], targets: compactTargets(planTargets(draft.profile)) }
  }
  if (!Array.isArray(draft.diary[date].items)) draft.diary[date].items = []
  return draft.diary[date]
}

function sortSessions(list) {
  list.sort((a, b) => a.date.localeCompare(b.date) || String(a.startedAt).localeCompare(String(b.startedAt)))
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('Store missing')
  return value
}

function writeSession(key, value) {
  try {
    if (value == null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Session storage is a convenience only.
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState)
  const [storageError, setStorageError] = useState('')
  const [toast, setToast] = useState(null)
  const [draft, setDraftState] = useState(loadDraft)
  const [pendingStart, setPendingStart] = useState(null)
  // The app always opens on today. It also notices when midnight passes while it is open.
  const [viewDate, setViewDateState] = useState(() => todayKey())
  const [today, setToday] = useState(() => todayKey())
  const todayRef = useRef(today)
  const toastTimer = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const update = useCallback((recipe) => {
    setState((prev) => {
      const next = structuredClone(prev)
      recipe(next)
      const error = persist(next)
      queueMicrotask(() => setStorageError(error))
      return next
    })
  }, [])

  // The desktop app also keeps a copy of the data on disk.
  useEffect(() => {
    if (!window.dailyPlate?.saveBackup || !state.profile) return undefined
    const id = setTimeout(() => {
      window.dailyPlate.saveBackup(JSON.stringify(state)).catch(() => {})
    }, 2500)
    return () => clearTimeout(id)
  }, [state])

  const flash = useCallback((message, undo) => {
    setToast({ id: Date.now() + Math.random(), message, undo })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), undo ? 6500 : 3800)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  useEffect(() => {
    const check = () => {
      const now = todayKey()
      if (now === todayRef.current) return
      const before = todayRef.current
      todayRef.current = now
      setToday(now)
      setViewDateState((current) => (current === before ? now : current))
    }
    const id = setInterval(check, 20000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  const setViewDate = useCallback((date) => {
    setViewDateState(date)
    writeSession(DATE_KEY, date)
  }, [])

  const setDraft = useCallback((value) => {
    setDraftState((current) => {
      const next = typeof value === 'function' ? value(current) : value
      try {
        if (next) localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
        else localStorage.removeItem(DRAFT_KEY)
      } catch {
        // The draft stays in memory if storage is full.
      }
      return next
    })
  }, [])

  const api = useMemo(() => {
    const allFoods = [...state.customFoods, ...builtInFoods]
    const targets = planTargets(state.profile)
    return {
      state,
      allFoods,
      targets,
      storageError,
      toast,
      dismissToast: () => setToast(null),
      flash,
      draft,
      setDraft,
      pendingStart,
      setPendingStart,
      viewDate,
      setViewDate,
      today,
      setTheme(theme) {
        update((next) => { next.settings = { ...next.settings, theme } })
      },
      saveProfile(profile) {
        update((next) => {
          const previous = next.profile
          const saved = {
            ...profile,
            trackingStart: previous?.trackingStart || profile.trackingStart || todayKey(),
            createdAt: previous?.createdAt || new Date().toISOString(),
          }
          next.profile = saved
          const today = todayKey()
          if (!previous || previous.weightKg !== saved.weightKg) upsertWeight(next, today, saved.weightKg)
          refreshTargets(next)
        })
      },
      addFoodItem(date, item) {
        update((next) => {
          const day = ensureDay(next, date)
          day.items.push(item)
          if (item.foodId) {
            next.recentFoodIds = [item.foodId, ...next.recentFoodIds.filter((id) => id !== item.foodId)].slice(0, 12)
          }
        })
      },
      replaceFoodItem(date, item) {
        update((next) => {
          const day = ensureDay(next, date)
          const index = day.items.findIndex((entry) => entry.id === item.id)
          if (index >= 0) day.items[index] = item
        })
      },
      removeFoodItem(date, id) {
        const items = stateRef.current.diary[date]?.items || []
        const index = items.findIndex((item) => item.id === id)
        if (index < 0) return
        const removed = items[index]
        update((next) => {
          next.diary[date].items = next.diary[date].items.filter((item) => item.id !== id)
        })
        flash(`Removed ${removed.name}`, () => update((next) => {
          const day = ensureDay(next, date)
          if (!day.items.some((item) => item.id === removed.id)) day.items.splice(Math.min(index, day.items.length), 0, removed)
        }))
      },
      moveFoodItem(date, id, meal) {
        update((next) => {
          const item = next.diary[date]?.items?.find((entry) => entry.id === id)
          if (item) item.meal = meal
        })
      },
      copyDiary(from, to, meal) {
        const source = (stateRef.current.diary[from]?.items || []).filter((item) => !meal || item.meal === meal)
        if (!source.length) return 0
        update((next) => {
          const day = ensureDay(next, to)
          for (const item of source) day.items.push({ ...item, id: newId() })
        })
        return source.length
      },
      toggleFavorite(foodId) {
        update((next) => {
          if (next.favorites.includes(foodId)) next.favorites = next.favorites.filter((id) => id !== foodId)
          else next.favorites = [foodId, ...next.favorites]
        })
      },
      saveCustomFood(food) {
        update((next) => {
          const index = next.customFoods.findIndex((item) => item.id === food.id)
          if (index >= 0) next.customFoods[index] = food
          else next.customFoods.unshift(food)
        })
      },
      deleteCustomFood(id) {
        const snapshot = stateRef.current
        const index = snapshot.customFoods.findIndex((food) => food.id === id)
        if (index < 0) return
        const removed = snapshot.customFoods[index]
        const wasFavorite = snapshot.favorites.includes(id)
        update((next) => {
          next.customFoods = next.customFoods.filter((food) => food.id !== id)
          next.favorites = next.favorites.filter((foodId) => foodId !== id)
          next.recentFoodIds = next.recentFoodIds.filter((foodId) => foodId !== id)
        })
        flash(`Deleted ${removed.name}`, () => update((next) => {
          if (next.customFoods.some((food) => food.id === id)) return
          next.customFoods.splice(Math.min(index, next.customFoods.length), 0, removed)
          if (wasFavorite) next.favorites = [id, ...next.favorites]
        }))
      },
      addWater(date, amount) {
        update((next) => {
          next.water[date] = Math.max(0, Math.round((next.water[date] || 0) + amount))
        })
      },
      logWeight(date, kg) {
        update((next) => {
          upsertWeight(next, date, kg)
          syncProfileWeight(next)
        })
      },
      deleteWeight(date) {
        update((next) => {
          next.weightLog = next.weightLog.filter((entry) => entry.date !== date)
          syncProfileWeight(next)
        })
      },
      savePlan(plan) {
        update((next) => {
          const index = next.plans.findIndex((item) => item.id === plan.id)
          if (index >= 0) next.plans[index] = plan
          else next.plans.unshift(plan)
        })
      },
      deletePlan(id) {
        const plans = stateRef.current.plans
        const index = plans.findIndex((plan) => plan.id === id)
        if (index < 0) return
        const removed = plans[index]
        update((next) => {
          next.plans = next.plans.filter((plan) => plan.id !== id)
        })
        flash(`Deleted ${removed.name}`, () => update((next) => {
          if (!next.plans.some((plan) => plan.id === id)) next.plans.splice(Math.min(index, next.plans.length), 0, removed)
        }))
      },
      applySchedule(weekdays, planId) {
        update((next) => {
          if (!next.profile) return
          next.profile.workoutDays = [...new Set(weekdays)].sort((a, b) => a - b)
          if (planId) next.profile.activePlanId = planId
        })
      },
      resetWorkouts() {
        update((next) => {
          next.sessions = []
          if (next.profile) next.profile.trackingStart = todayKey()
        })
        setDraft(null)
      },
      saveSession(session) {
        update((next) => {
          const index = next.sessions.findIndex((item) => item.id === session.id)
          if (index >= 0) next.sessions[index] = session
          else next.sessions.push(session)
          sortSessions(next.sessions)
        })
      },
      deleteSession(id) {
        const removed = stateRef.current.sessions.find((session) => session.id === id)
        if (!removed) return
        update((next) => {
          next.sessions = next.sessions.filter((session) => session.id !== id)
        })
        flash(`Deleted ${removed.name}`, () => update((next) => {
          if (next.sessions.some((session) => session.id === id)) return
          next.sessions.push(removed)
          sortSessions(next.sessions)
        }))
      },
      importState(parsed) {
        if (!isObject(parsed) || parsed.version !== 1 || !isObject(parsed.profile)) {
          throw new Error('That file is not a Daily Plate backup.')
        }
        const next = normalizeState(parsed)
        // An imported backup is taken as it is; one-time fixes are not applied to it.
        next.settings.fixes = [...new Set([...(next.settings.fixes || []), ...KNOWN_FIXES])]
        const error = persist(next)
        setState(next)
        setStorageError(error)
        setDraft(null)
      },
      erase() {
        try {
          localStorage.removeItem(KEY)
          localStorage.removeItem(DRAFT_KEY)
        } catch {
          // nothing to remove
        }
        writeSession(DATE_KEY, null)
        setState(defaultState())
        setDraft(null)
        setViewDateState(todayKey())
        setStorageError('')
      },
    }
  }, [state, storageError, toast, flash, draft, setDraft, pendingStart, viewDate, setViewDate, today, update])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function targetsForDate(state, date, live) {
  return state.diary[date]?.targets || (live ? {
    calories: live.calories,
    proteinG: live.proteinG,
    carbsG: live.carbsG,
    fatG: live.fatG,
    fiberG: live.fiberG,
  } : null)
}
