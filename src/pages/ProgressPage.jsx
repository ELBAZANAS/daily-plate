import { useMemo, useState } from 'react'
import { useStore, targetsForDate } from '../store.jsx'
import { exerciseById, groupColors } from '../data/exercises.js'
import { BarChart, HBars, LineChart } from '../components/Chart.jsx'
import { Icon } from '../components/Icon.jsx'
import { Banner, Chips, Empty, NumberInput, PageHead, Stat } from '../components/ui.jsx'
import { formatSet } from '../components/Exercises.jsx'
import { addDays, prettyDate, todayKey, weekStart } from '../lib/dates.js'
import { roundKcal, sumNutrition } from '../lib/nutrition.js'
import { bestSet, epley, personalRecords, rollingAverage, sessionVolume, setsByGroup } from '../lib/training.js'
import { formatWeight, lbToKg, round1, storeKg } from '../lib/units.js'

const periods = [
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['all', 'All time'],
  ['custom', 'Custom'],
]

const colors = { weight: 'var(--accent)', average: 'var(--ink-2)', lift: 'var(--accent)', e1rm: 'var(--carbs)' }

export function ProgressPage() {
  const { state, targets, logWeight, deleteWeight, viewDate, flash } = useStore()
  const units = state.profile.units
  const today = todayKey()
  const [weight, setWeight] = useState('')
  const [weightDate, setWeightDate] = useState(viewDate)
  const [error, setError] = useState('')
  const [preset, setPresetState] = useState('week')
  const [offset, setOffset] = useState(0)
  const setPreset = (next) => { setPresetState(next); setOffset(0) }
  const [customStart, setCustomStart] = useState(addDays(today, -29))
  const [customEnd, setCustomEnd] = useState(today)
  const earliest = earliestDate(state) || addDays(today, -29)
  const range = bounds(preset, offset, customStart, customEnd, today, earliest)
  const unit = units === 'imperial' ? 'lb' : 'kg'
  const shownWeight = (kg) => (units === 'imperial' ? round1(kg / 0.45359237) : round1(kg))

  const weights = state.weightLog.filter((entry) => entry.date >= range.start && entry.date <= range.end)
  const weightLabels = weights.map((entry) => prettyDate(entry.date, { month: 'short', day: 'numeric' }))
  const weightValues = weights.map((entry) => shownWeight(entry.kg))
  const averageAll = rollingAverage(state.weightLog)
  const average = state.weightLog
    .map((entry, index) => ({ date: entry.date, value: shownWeight(averageAll[index]) }))
    .filter((entry) => entry.date >= range.start && entry.date <= range.end)
    .map((entry) => entry.value)

  const calorieRows = calorieSeries(state, range, targets)
  const weekly = weeklyLoad(state.sessions, range, units)
  const summary = summarize(state, range, units)
  const rangeSessions = state.sessions.filter((session) => session.date >= range.start && session.date <= range.end)
  const groups = setsByGroup(rangeSessions, exerciseById).map((row) => ({ label: row.group, value: row.sets, color: groupColors[row.group] }))
  const records = useMemo(() => [...personalRecords(state.sessions).values()]
    .map((record) => ({ ...record, info: exerciseById(record.exerciseId) }))
    .filter((record) => record.info && record.weight && record.info.logging === 'strength')
    .sort((a, b) => (b.weight.date || '').localeCompare(a.weight.date || ''))
    .slice(0, 12), [state.sessions])

  const strengthIds = [...new Set(state.sessions.flatMap((session) => session.exercises.map((item) => item.exerciseId)))]
    .filter((id) => exerciseById(id)?.logging === 'strength' && state.sessions.some((session) => session.exercises.some((item) => item.exerciseId === id && item.sets.some((set) => set.weightKg > 0))))
  const [exerciseId, setExerciseId] = useState(strengthIds[0] || '')
  const selectedId = strengthIds.includes(exerciseId) ? exerciseId : strengthIds[0] || ''
  const strength = useMemo(() => liftSeries(state.sessions, selectedId, range), [selectedId, state.sessions, range.start, range.end])

  function saveWeight(event) {
    event.preventDefault()
    const value = Number(weight)
    if (!(value > 0)) return setError('Enter a weight.')
    const kg = units === 'imperial' ? lbToKg(value) : value
    if (kg < 30 || kg > 250) return setError(`That weight is outside ${units === 'imperial' ? '66–551 lb' : '30–250 kg'}.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weightDate) || weightDate > today) return setError('Pick a date that is not in the future.')
    logWeight(weightDate, storeKg(kg))
    setWeight('')
    setError('')
    flash(`Weight logged for ${prettyDate(weightDate)}`)
  }

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Progress" title="How it is going">
        <p className="muted">Pick a week, month or year — every chart and number below uses the same dates.</p>
      </PageHead>
      <div className="period-bar">
        <Chips label="Period" options={periods} value={preset} onChange={setPreset} />
        {range.stepper && (
          <div className="period-nav">
            <button className="icon-btn bordered" type="button" aria-label={`Previous ${preset}`} onClick={() => setOffset((value) => value - 1)}><Icon name="left" /></button>
            <strong>{range.label}</strong>
            <button className="icon-btn bordered" type="button" aria-label={`Next ${preset}`} disabled={offset >= 0} onClick={() => setOffset((value) => Math.min(0, value + 1))}><Icon name="right" /></button>
            {offset < 0 && <button className="btn ghost small" type="button" onClick={() => setOffset(0)}>Current</button>}
          </div>
        )}
      </div>
      {!range.stepper && <p className="muted small">{prettyDate(range.start, { month: 'short', day: 'numeric', year: 'numeric' })} – {prettyDate(range.end, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
      {preset === 'custom' && (
        <div className="grid-2 narrow">
          <label className="field"><span className="field-label">From</span><input type="date" value={customStart} max={today} onChange={(event) => setCustomStart(event.target.value)} /></label>
          <label className="field"><span className="field-label">To</span><input type="date" value={customEnd} max={today} onChange={(event) => setCustomEnd(event.target.value)} /></label>
        </div>
      )}

      <section className="stat-grid">
        <Stat label="Weight change" value={summary.weight} detail={summary.weightDetail} tone={summary.weightTone} />
        <Stat label="Average intake" value={summary.calories} detail={summary.calorieDetail} />
        <Stat label="Workouts" value={summary.workouts} detail={summary.workoutDetail} />
        <Stat label="Training load" value={summary.load} detail={`${unit} × reps`} />
      </section>

      <div className="grid-main">
        <section className="card stack">
          <div className="section-head"><h2>Body weight</h2><span className="muted small">{weights.length} weigh-in{weights.length === 1 ? '' : 's'}</span></div>
          {weights.length >= 2 ? (
            <LineChart labels={weightLabels} unit={unit} series={[
              { name: 'Weigh-in', color: colors.weight, values: weightValues },
              { name: '7-day average', color: colors.average, dashed: true, values: average },
            ]} />
          ) : <Empty icon="scale" title="Log two weigh-ins to draw the line">The dashed line is a 7-day average — it matters more than any single morning.</Empty>}
          <form className="weight-form" onSubmit={saveWeight}>
            <label className="field"><span className="field-label">Date</span><input type="date" value={weightDate} max={today} onChange={(event) => setWeightDate(event.target.value)} /></label>
            <label className="field grow"><span className="field-label">Weight ({unit})</span><NumberInput value={weight} onChange={setWeight} placeholder={state.weightLog.at(-1) ? String(shownWeight(state.weightLog.at(-1).kg)) : ''} /></label>
            <button className="btn primary" type="submit">Log weight</button>
          </form>
          {error && <Banner tone="bad">{error}</Banner>}
          {weights.length > 0 && (
            <ul className="plain-list">
              {[...weights].reverse().slice(0, 6).map((entry) => (
                <li key={entry.date}>
                  <span>{prettyDate(entry.date)}</span>
                  <strong>{formatWeight(entry.kg, units)}</strong>
                  <button className="icon-btn danger" type="button" aria-label={`Remove weight on ${prettyDate(entry.date)}`} onClick={() => deleteWeight(entry.date)}><Icon name="trash" size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card stack">
          <div className="section-head"><h2>{calorieRows.unit === 'month' ? 'Calories by month' : calorieRows.unit === 'week' ? 'Calories by week' : 'Calories by day'}</h2></div>
          <BarChart rows={calorieRows.rows} unit="kcal" goal={calorieRows.weekly ? 0 : targets?.calories || 0} color="var(--carbs)" />
          <p className="muted small">
            {calorieRows.weekly
              ? `Each bar is the daily average of the days you logged that ${calorieRows.unit}. Days with nothing logged are left out.`
              : 'The line is your current goal. A day with nothing logged shows as empty, which is not the same as eating nothing.'}
          </p>
        </section>
      </div>

      <div className="grid-main">
        <section className="card stack">
          <div className="section-head"><h2>Training load by {weekly[0]?.unit || 'week'}</h2></div>
          {weekly.some((row) => row.value > 0) ? <BarChart rows={weekly} unit={`${unit} × reps`} color="var(--accent)" /> : <Empty icon="dumbbell" title="No weighted sets in these dates">Load is weight × reps. Bodyweight sets with no added weight do not add load.</Empty>}
        </section>
        <section className="card stack">
          <div className="section-head"><h2>Sets per muscle group</h2><span className="muted small">{rangeSessions.length} workout{rangeSessions.length === 1 ? '' : 's'}</span></div>
          {groups.length ? <HBars rows={groups} unit="sets" /> : <Empty icon="chart" title="Nothing logged in these dates">Finish a workout and the split shows up here.</Empty>}
          {groups.length > 0 && <p className="muted small">Most people grow well on roughly 10–20 hard sets per muscle group per week.</p>}
        </section>
      </div>

      <section className="card stack">
        <div className="section-head"><h2>A lift over time</h2></div>
        {strengthIds.length === 0 ? <Empty icon="trophy" title="No weighted lifts yet">Finish a workout with a weighted set and it shows up here.</Empty> : (
          <>
            <label className="field narrow-field">
              <span className="field-label">Exercise</span>
              <select value={selectedId} onChange={(event) => setExerciseId(event.target.value)}>
                {strengthIds.map((id) => <option key={id} value={id}>{exerciseById(id)?.title}</option>)}
              </select>
            </label>
            {strength.length === 0 && <p className="muted">No weighted sets for this exercise in the selected dates.</p>}
            {strength.length >= 1 && (
              <LineChart labels={strength.map((item) => prettyDate(item.date, { month: 'short', day: 'numeric' }))} unit={unit} series={liftLines(strength, units)} />
            )}
            {strength.length > 0 && (
              <ul className="plain-list">
                {[...strength].reverse().slice(0, 8).map((item) => (
                  <li key={item.date}>
                    <span>{prettyDate(item.date)}</span>
                    <strong>{formatWeight(item.set.weightKg, units)} × {item.set.reps}</strong>
                    <span className="muted small">{item.estimate ? `est. 1RM ${formatWeight(item.estimate, units)}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">Solid line: heaviest set that day. Dashed: estimated one-rep max (Epley, sets of 1–12 reps) — a way to compare, not a weight to attempt.</p>
          </>
        )}
      </section>

      {records.length > 0 && (
        <section className="card stack">
          <div className="section-head"><h2><Icon name="trophy" size={18} /> Personal bests</h2><span className="muted small">All time</span></div>
          <div className="pr-table">
            {records.map((record) => (
              <div key={record.exerciseId} className="pr-row">
                <strong>{record.info.title}</strong>
                <span>{formatSet(record.weight, record.info, units)}</span>
                <span className="muted small">{record.e1rm ? `est. 1RM ${formatWeight(record.e1rm.value, units)}` : ''}</span>
                <span className="muted small">{prettyDate(record.weight.date)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const monthName = (year, month) => new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

// A calendar week (Mon–Sun), month or year, moved back by `offset` periods.
// The current period stops at today, so the charts never show future days.
export function bounds(preset, offset, customStart, customEnd, today, earliest) {
  if (preset === 'custom') {
    const start = customStart || addDays(today, -29)
    const end = customEnd || today
    return start <= end ? { start, end } : { start: end, end: start }
  }
  if (preset === 'all') return { start: earliest < today ? earliest : today, end: today }
  const [y, m] = today.split('-').map(Number)
  let start
  let end
  let label
  if (preset === 'week') {
    start = addDays(weekStart(today), offset * 7)
    end = addDays(start, 6)
    const short = { month: 'short', day: 'numeric' }
    label = offset === 0 ? `This week · ${prettyDate(start, short)} – ${prettyDate(end, short)}`
      : offset === -1 ? `Last week · ${prettyDate(start, short)} – ${prettyDate(end, short)}`
        : `${prettyDate(start, short)} – ${prettyDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`
  } else if (preset === 'month') {
    const first = new Date(y, m - 1 + offset, 1)
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
    start = todayKeyOf(first)
    end = todayKeyOf(last)
    label = monthName(first.getFullYear(), first.getMonth())
  } else {
    const year = y + offset
    start = `${year}-01-01`
    end = `${year}-12-31`
    label = String(year)
  }
  return { start, end: end > today ? today : end, periodEnd: end, label, stepper: true }
}

function todayKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Splits a date range into chart bars: days for up to ~6 weeks, then weeks, then months.
export function buckets(range) {
  const span = (Date.parse(range.end) - Date.parse(range.start)) / 86400000 + 1
  const out = []
  if (span <= 45) {
    for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
      out.push({ start: date, end: date, unit: 'day', label: span <= 7 ? prettyDate(date, { weekday: 'short' }) : prettyDate(date, { day: 'numeric' }), tipLabel: prettyDate(date) })
    }
  } else if (span <= 130) {
    for (let cursor = weekStart(range.start); cursor <= range.end; cursor = addDays(cursor, 7)) {
      out.push({ start: cursor < range.start ? range.start : cursor, end: addDays(cursor, 6) > range.end ? range.end : addDays(cursor, 6), unit: 'week', label: prettyDate(cursor, { month: 'short', day: 'numeric' }), tipLabel: `Week of ${prettyDate(cursor, { month: 'short', day: 'numeric' })}` })
    }
  } else {
    let [y, m] = range.start.split('-').map(Number)
    for (;;) {
      const first = `${y}-${String(m).padStart(2, '0')}-01`
      if (first > range.end) break
      const last = todayKeyOf(new Date(y, m, 0))
      const date = new Date(y, m - 1, 1)
      out.push({ start: first < range.start ? range.start : first, end: last > range.end ? range.end : last, unit: 'month', label: date.toLocaleDateString(undefined, { month: 'short' }), tipLabel: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) })
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
  }
  return out
}

function earliestDate(state) {
  const dates = [
    state.profile?.trackingStart,
    ...state.weightLog.map((entry) => entry.date),
    ...state.sessions.map((session) => session.date),
    ...Object.keys(state.diary),
  ].filter(Boolean).sort()
  return dates[0] || null
}

function calorieSeries(state, range, targets) {
  const parts = buckets(range)
  const unit = parts[0]?.unit || 'day'
  const rows = parts.map((part) => {
    if (unit === 'day') {
      const kcal = sumNutrition(state.diary[part.start]?.items).kcal
      const goal = targetsForDate(state, part.start, targets)?.calories
      return { label: part.label, tipLabel: part.tipLabel, value: roundKcal(kcal), note: goal ? `goal ${goal.toLocaleString()} kcal` : '' }
    }
    const logged = []
    for (let date = part.start; date <= part.end; date = addDays(date, 1)) {
      const items = state.diary[date]?.items || []
      if (items.length) logged.push(sumNutrition(items).kcal)
    }
    const value = logged.length ? logged.reduce((sum, kcal) => sum + kcal, 0) / logged.length : 0
    return { label: part.label, tipLabel: part.tipLabel, value: Math.round(value), note: logged.length ? `daily average of ${logged.length} logged day${logged.length === 1 ? '' : 's'}` : 'nothing logged' }
  })
  return { weekly: unit !== 'day', unit, rows }
}

function weeklyLoad(sessions, range, units) {
  return buckets(range).map((part) => {
    const inPart = sessions.filter((session) => session.date >= part.start && session.date <= part.end)
    const load = inPart.reduce((sum, session) => sum + sessionVolume(session), 0)
    return {
      label: part.label,
      tipLabel: part.tipLabel,
      value: Math.round(units === 'imperial' ? load / 0.45359237 : load),
      note: `${inPart.length} workout${inPart.length === 1 ? '' : 's'}`,
      unit: part.unit,
    }
  })
}

function summarize(state, range, units) {
  const unit = units === 'imperial' ? 'lb' : 'kg'
  const weights = state.weightLog.filter((entry) => entry.date >= range.start && entry.date <= range.end)
  let weight = '—'
  let weightDetail = 'Needs two weigh-ins'
  let weightTone = ''
  if (weights.length >= 2) {
    const delta = weights.at(-1).kg - weights[0].kg
    const shown = units === 'imperial' ? round1(delta / 0.45359237) : round1(delta)
    weight = `${shown > 0 ? '+' : ''}${shown} ${unit}`
    weightDetail = `${prettyDate(weights[0].date, { month: 'short', day: 'numeric' })} → ${prettyDate(weights.at(-1).date, { month: 'short', day: 'numeric' })}`
    const goal = state.profile?.goal
    if (shown !== 0 && (goal === 'lose' || goal === 'gain')) weightTone = (goal === 'lose') === (shown < 0) ? 'good' : 'warn'
  }
  const logged = []
  let days = 0
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    days += 1
    const items = state.diary[date]?.items || []
    if (items.length) logged.push(sumNutrition(items).kcal)
  }
  const calories = logged.length ? `${roundKcal(logged.reduce((sum, kcal) => sum + kcal, 0) / logged.length).toLocaleString()} kcal` : '—'
  const sessions = state.sessions.filter((session) => session.date >= range.start && session.date <= range.end)
  const loadKg = sessions.reduce((sum, session) => sum + sessionVolume(session), 0)
  const loadShown = units === 'imperial' ? Math.round(loadKg / 0.45359237) : Math.round(loadKg)
  const minutes = sessions.reduce((sum, session) => sum + (session.minutes || 0), 0)
  return {
    weight,
    weightDetail,
    weightTone,
    calories,
    calorieDetail: `${logged.length} of ${days} day${days === 1 ? '' : 's'} logged`,
    workouts: String(sessions.length),
    workoutDetail: minutes ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60} min total` : 'None yet',
    load: loadShown ? loadShown.toLocaleString() : '0',
  }
}

function liftSeries(sessions, exerciseId, range) {
  if (!exerciseId) return []
  const byDate = new Map()
  for (const session of sessions) {
    if (session.date < range.start || session.date > range.end) continue
    const set = bestSet(session.exercises.find((item) => item.exerciseId === exerciseId)?.sets)
    if (!set) continue
    const current = byDate.get(session.date)
    if (!current || set.weightKg > current.weightKg) byDate.set(session.date, set)
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, set]) => ({
    date,
    set,
    estimate: epley(set.weightKg, set.reps),
  }))
}

function liftLines(strength, units) {
  const toUnit = (kg) => units === 'imperial' ? round1(kg / 0.45359237) : round1(kg)
  const lines = [{ name: 'Best set', color: colors.lift, values: strength.map((item) => toUnit(item.set.weightKg)) }]
  if (strength.every((item) => item.estimate)) {
    lines.push({ name: 'Est. 1RM', color: colors.e1rm, dashed: true, values: strength.map((item) => toUnit(item.estimate)) })
  }
  return lines
}
