import { useState } from 'react'
import { useRoute } from '../router.jsx'
import { useStore, targetsForDate } from '../store.jsx'
import { exerciseById } from '../data/exercises.js'
import { addDays, greeting, prettyDate, todayKey, weekday } from '../lib/dates.js'
import { roundKcal, sumNutrition } from '../lib/nutrition.js'
import { sessionSetCount, sessionVolume } from '../lib/training.js'
import { formatWeight, kgToLb, lbToKg, round1, storeKg } from '../lib/units.js'
import { MacroBar } from '../components/Ring.jsx'
import { Icon } from '../components/Icon.jsx'
import { Banner, NumberInput, Progress } from '../components/ui.jsx'
import { DiaryMeals } from './DiaryPage.jsx'

export function foodStreak(diary, today) {
  let cursor = diary[today]?.items?.length ? today : addDays(today, -1)
  if (!diary[cursor]?.items?.length) return 0
  let count = 0
  while (diary[cursor]?.items?.length) {
    count += 1
    cursor = addDays(cursor, -1)
    if (count > 3000) break
  }
  return count
}

// The plan in use: the one picked in Plans, or else the plan whose weekdays match the
// training days set in Goals. With neither, every plan's days for that weekday are shown.
export function currentPlan(state) {
  const picked = state.plans.find((plan) => plan.id === state.profile?.activePlanId)
  if (picked) return picked
  const days = [...new Set(state.profile?.workoutDays || [])].sort().join(',')
  if (!days) return null
  return state.plans.find((plan) => [...new Set(plan.days.map((item) => item.weekday))].sort().join(',') === days) || null
}

export function plannedDays(state, date) {
  const day = weekday(date)
  const out = []
  const active = currentPlan(state)
  for (const plan of active ? [active] : state.plans) {
    for (const item of plan.days) if (item.weekday === day) out.push({ plan, day: item })
  }
  return out
}

export function TodayPage() {
  const { go } = useRoute()
  const { state, targets, viewDate, draft, setPendingStart } = useStore()
  const items = state.diary[viewDate]?.items || []
  const totals = sumNutrition(items)
  const dayTargets = targetsForDate(state, viewDate, targets)
  const calories = dayTargets?.calories || 0
  const remaining = calories - totals.kcal
  const today = todayKey()
  const isToday = viewDate === today
  const streak = foodStreak(state.diary, today)
  const name = state.profile.name?.trim()
  const sessions = state.sessions.filter((session) => session.date === viewDate)
  const scheduled = (state.profile.workoutDays || []).includes(weekday(viewDate))
  const planned = plannedDays(state, viewDate)

  return (
    <div className="page stack-lg">
      <header className="page-head">
        <div className="page-head-text">
          <p className="eyebrow">{prettyDate(viewDate, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>{isToday ? (name ? `${greeting()}, ${name}` : greeting()) : 'Day overview'}</h1>
        </div>
        <div className="page-actions">
          <span className={`streak ${streak ? 'on' : ''}`} title="Days in a row with food logged"><Icon name="flame" size={16} />{streak ? `${streak}-day streak` : 'No streak yet'}</span>
        </div>
      </header>

      <section className="card hero label-panel" aria-label="Calories and macros">
        <div className="label-kcal">
          <p className="label-name">{isToday ? 'Today’s plate' : 'This day’s plate'}</p>
          <div className={`label-big ${remaining < 0 ? 'over' : ''}`}>
            <strong>{roundKcal(Math.abs(remaining)).toLocaleString()}</strong>
            <span>{remaining >= 0 ? 'kcal left' : 'kcal over'}</span>
          </div>
          <div className={`plate-meter ${remaining < 0 ? 'over' : ''}`} role="progressbar" aria-label={`${Math.round(totals.kcal)} of ${calories} calories eaten`}
            aria-valuemin={0} aria-valuemax={calories} aria-valuenow={Math.round(totals.kcal)}>
            <div style={{ width: `${calories > 0 ? Math.min(100, (totals.kcal / calories) * 100) : 0}%` }} />
          </div>
          <dl className="label-split">
            <div><dt>Eaten</dt><dd>{roundKcal(totals.kcal).toLocaleString()}</dd></div>
            <div><dt>Goal</dt><dd>{calories.toLocaleString()}</dd></div>
            <div><dt>Protein to go</dt><dd>{Math.max(0, Math.round((dayTargets?.proteinG || 0) - totals.protein))} g</dd></div>
          </dl>
        </div>
        <div className="label-rows">
          <p className="label-name label-rows-head"><span>Macros</span><span className="muted small">eaten / target</span></p>
          <MacroBar label="Protein" value={totals.protein} goal={dayTargets?.proteinG || 0} tone="protein" />
          <MacroBar label="Carbs" value={totals.carbs} goal={dayTargets?.carbsG || 0} tone="carbs" />
          <MacroBar label="Fat" value={totals.fat} goal={dayTargets?.fatG || 0} tone="fat" />
          <MacroBar label="Fiber" value={totals.fiber} goal={dayTargets?.fiberG || 0} tone="fiber" />
          <p className="label-foot">Sodium {roundKcal(totals.sodium).toLocaleString()} mg · Sugar {roundKcal(totals.sugar)} g</p>
        </div>
      </section>

      <section className="tiles">
        <WaterCard date={viewDate} />
        <article className="card tile">
          <header className="tile-head">
            <span className="tile-icon tone-train"><Icon name="dumbbell" /></span>
            <h2>Training</h2>
          </header>
          {draft ? (
            <>
              <p><strong>{draft.name}</strong> is in progress.</p>
              <button className="btn primary small" type="button" onClick={() => go('train')}><Icon name="play" size={15} />Continue workout</button>
            </>
          ) : sessions.length > 0 ? (
            <div className="stack-sm">
              {sessions.map((session) => (
                <div key={session.id} className="mini-session">
                  <strong>{session.name}</strong>
                  <span className="muted small">{session.minutes || 0} min · {sessionSetCount(session)} sets · {Math.round(state.profile.units === 'imperial' ? kgToLb(sessionVolume(session)) : sessionVolume(session)).toLocaleString()} {state.profile.units === 'imperial' ? 'lb' : 'kg'} moved</span>
                </div>
              ))}
              <button className="btn ghost small" type="button" onClick={() => go('train')}>Open training</button>
            </div>
          ) : planned.length > 0 ? (
            <div className="stack-sm">
              {planned.slice(0, 2).map(({ plan, day }) => (
                <div key={day.id} className="planned-line">
                  <div>
                    <strong>{day.name}</strong>
                    <span className="muted small">{plan.name} · {day.exercises.length} exercises</span>
                  </div>
                  <button className="btn primary small" type="button" onClick={() => { setPendingStart({ planId: plan.id, dayId: day.id }); go('train') }}><Icon name="play" size={14} />Start</button>
                </div>
              ))}
              {planned.length > 2 && <button className="link-btn" type="button" onClick={() => go('train')}>{planned.length - 2} more planned</button>}
            </div>
          ) : (
            <>
              <p className="muted">{scheduled ? 'A training day, but no plan day lands on it.' : 'Rest day. Recovery is part of the plan.'}</p>
              <button className="btn ghost small" type="button" onClick={() => go('train')}>Start a workout anyway</button>
            </>
          )}
          {planned.length > 0 && !sessions.length && !draft && (
            <p className="muted small">{planned[0].day.exercises.slice(0, 3).map((slot) => exerciseById(slot.exerciseId)?.title).filter(Boolean).join(' · ')}{planned[0].day.exercises.length > 3 ? ' …' : ''}</p>
          )}
        </article>
        <WeightCard date={viewDate} />
      </section>

      <section className="stack">
        <div className="section-head">
          <h2>Meals</h2>
          <button className="link-btn" type="button" onClick={() => go('diary')}>Open diary <Icon name="right" size={14} /></button>
        </div>
        <DiaryMeals date={viewDate} compact />
      </section>
    </div>
  )
}

const liters = (ml) => String(Math.round(ml / 10) / 100)

function WaterCard({ date }) {
  const { state, targets, addWater } = useStore()
  const water = state.water[date] || 0
  const goal = targets?.waterMl || 2000
  const glasses = Math.min(12, Math.ceil(goal / 250))
  const filled = Math.floor(water / 250)
  return (
    <article className="card tile">
      <header className="tile-head">
        <span className="tile-icon tone-water"><Icon name="drop" /></span>
        <h2>Water</h2>
        <span className="tile-value">{liters(water)} / {liters(goal)} L</span>
      </header>
      <div className="glasses" aria-hidden="true">
        {Array.from({ length: glasses }, (_, index) => <i key={index} className={index < filled ? 'on' : ''} />)}
      </div>
      <Progress value={water} max={goal} tone="water" label="Water" />
      <div className="row gap wrap">
        <button className="btn soft small" type="button" onClick={() => addWater(date, 250)}>+250 ml</button>
        <button className="btn soft small" type="button" onClick={() => addWater(date, 500)}>+500 ml</button>
        <button className="btn ghost small" type="button" disabled={!water} onClick={() => addWater(date, -250)}>−250</button>
      </div>
    </article>
  )
}

function WeightCard({ date }) {
  const { state, logWeight, flash } = useStore()
  const units = state.profile.units
  const unit = units === 'imperial' ? 'lb' : 'kg'
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const entry = state.weightLog.find((item) => item.date === date)
  const before = [...state.weightLog].reverse().find((item) => item.date < date)
  const latest = entry || before
  const change = entry && before ? entry.kg - before.kg : null
  const target = state.profile.targetWeightKg

  function save(event) {
    event.preventDefault()
    const number = Number(value)
    const kg = units === 'imperial' ? lbToKg(number) : number
    if (!(number > 0) || kg < 30 || kg > 250) {
      setError(`Enter a weight between ${units === 'imperial' ? '66 and 551 lb' : '30 and 250 kg'}.`)
      return
    }
    if (date > todayKey()) {
      setError('This day has not happened yet. Weigh in on the day itself.')
      return
    }
    logWeight(date, storeKg(kg))
    setValue('')
    setError('')
    flash(`Weight logged for ${prettyDate(date)}`)
  }

  return (
    <article className="card tile">
      <header className="tile-head">
        <span className="tile-icon tone-weight"><Icon name="scale" /></span>
        <h2>Weight</h2>
        <span className="tile-value">{latest ? formatWeight(latest.kg, units) : '—'}</span>
      </header>
      <p className="muted small">
        {entry ? `Logged for this day${change != null ? ` · ${change > 0 ? '+' : ''}${units === 'imperial' ? round1(change / 0.45359237) : round1(change)} ${unit} since last time` : ''}.` : 'Weigh in the morning, before eating.'}
        {target ? ` Target ${formatWeight(target, units)}.` : ''}
      </p>
      <form className="inline-form" onSubmit={save}>
        <div className="input-unit">
          <NumberInput aria-label={`Weight in ${unit}`} value={value} onChange={setValue} placeholder={latest ? String(units === 'imperial' ? round1(latest.kg / 0.45359237) : round1(latest.kg)) : unit} />
          <span>{unit}</span>
        </div>
        <button className="btn soft small" type="submit">{entry ? 'Update' : 'Log'}</button>
      </form>
      {error && <Banner tone="bad">{error}</Banner>}
    </article>
  )
}
