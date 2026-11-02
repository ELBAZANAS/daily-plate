import { useState } from 'react'
import { useStore, targetsForDate } from '../store.jsx'
import { useRoute } from '../router.jsx'
import { monthMatrix, prettyDate, todayKey, weekday } from '../lib/dates.js'
import { roundKcal, sumNutrition } from '../lib/nutrition.js'
import { weekdayShort } from '../components/DateStepper.jsx'
import { Icon } from '../components/Icon.jsx'
import { Banner, PageHead } from '../components/ui.jsx'
import { foodStreak } from './TodayPage.jsx'

export function dayStatus(date, state, today) {
  const food = state.diary[date]?.items?.length || 0
  const sessions = state.sessions.filter((session) => session.date === date)
  const scheduled = (state.profile.workoutDays || []).includes(weekday(date))
  const past = date < today && date >= (state.profile.trackingStart || today)
  return {
    food,
    sessions,
    trained: sessions.length > 0,
    scheduled,
    missed: past && scheduled && !sessions.length,
    emptyFood: past && food === 0,
  }
}

function shiftMonth({ year, month }, delta) {
  const date = new Date(year, month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function CalendarPage() {
  const { state, targets, viewDate, setViewDate } = useStore()
  const { go } = useRoute()
  const [cursor, setCursor] = useState(() => {
    const [year, month] = viewDate.split('-').map(Number)
    return { year, month: month - 1 }
  })
  const weeks = monthMatrix(cursor.year, cursor.month)
  const today = todayKey()
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const streak = foodStreak(state.diary, today)

  const monthDays = weeks.flat().filter((date) => Number(date.slice(5, 7)) === cursor.month + 1)
  const stats = monthDays.reduce((acc, date) => {
    const status = dayStatus(date, state, today)
    if (status.food) acc.logged += 1
    if (status.trained) acc.workouts += status.sessions.length
    if (status.missed) acc.missed += 1
    return acc
  }, { logged: 0, workouts: 0, missed: 0 })

  const selected = dayStatus(viewDate, state, today)
  const selectedItems = state.diary[viewDate]?.items || []
  const selectedKcal = sumNutrition(selectedItems).kcal
  const selectedGoal = targetsForDate(state, viewDate, targets)?.calories

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Calendar" title={title}>
        <p className="muted">{streak > 0 ? `${streak}-day food streak. ` : ''}A planned training day in the past with no workout is marked missed.</p>
      </PageHead>
      <div className="calendar-layout">
        <section className="card stack">
          <div className="cal-nav">
            <button className="icon-btn bordered" type="button" aria-label="Previous month" onClick={() => setCursor((prev) => shiftMonth(prev, -1))}><Icon name="left" /></button>
            <strong>{title}</strong>
            <button className="icon-btn bordered" type="button" aria-label="Next month" onClick={() => setCursor((prev) => shiftMonth(prev, 1))}><Icon name="right" /></button>
            <button className="btn ghost small" type="button" onClick={() => {
              const now = new Date()
              setCursor({ year: now.getFullYear(), month: now.getMonth() })
              setViewDate(today)
            }}>Today</button>
          </div>
          <div className="cal-grid" role="grid" aria-label={title}>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => <div key={day} className="cal-label" role="columnheader">{weekdayShort[day]}</div>)}
            {weeks.flat().map((date) => {
              const status = dayStatus(date, state, today)
              const inMonth = Number(date.slice(5, 7)) === cursor.month + 1
              const kcal = status.food ? roundKcal(sumNutrition(state.diary[date].items).kcal) : 0
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  aria-selected={date === viewDate}
                  aria-label={`${prettyDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}${status.food ? `, ${kcal} kcal` : ''}${status.trained ? ', trained' : ''}${status.missed ? ', missed workout' : ''}`}
                  className={`cal-cell ${inMonth ? '' : 'out'} ${date === today ? 'today' : ''} ${date === viewDate ? 'sel' : ''} ${status.scheduled && date >= today ? 'planned' : ''}`}
                  onClick={() => setViewDate(date)}
                >
                  <span className="cal-num">{Number(date.slice(8))}</span>
                  {kcal > 0 && <span className="cal-kcal">{kcal.toLocaleString()}</span>}
                  <span className="cal-dots">
                    {status.food > 0 && <i className="dot food" />}
                    {status.trained && <i className="dot train" />}
                    {status.missed && <i className="dot miss" />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="legend">
            <span><i className="dot food" /> Meals logged</span>
            <span><i className="dot train" /> Workout</span>
            <span><i className="dot miss" /> Missed planned workout</span>
            <span><i className="dot planned" /> Planned</span>
          </div>
        </section>
        <aside className="stack">
          <section className="card stack">
            <p className="eyebrow">Selected day</p>
            <h2>{prettyDate(viewDate, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            <div className="detail-line"><Icon name="apple" size={17} /><span>{selected.food ? `${selected.food} food entr${selected.food === 1 ? 'y' : 'ies'} · ${roundKcal(selectedKcal).toLocaleString()}${selectedGoal ? ` of ${selectedGoal.toLocaleString()}` : ''} kcal` : 'No meals logged'}</span></div>
            <div className="detail-line"><Icon name="dumbbell" size={17} /><span>{selected.sessions.length ? selected.sessions.map((session) => `${session.name} (${session.minutes || 0} min)`).join(', ') : selected.scheduled ? 'Planned training day — no workout logged' : 'Not a planned training day'}</span></div>
            {selected.missed && <Banner tone="warn">This planned training day passed without a workout.</Banner>}
            <div className="row gap wrap">
              <button className="btn soft small" type="button" onClick={() => go('diary')}><Icon name="diary" size={15} />Open diary</button>
              <button className="btn soft small" type="button" onClick={() => go('train')}><Icon name="dumbbell" size={15} />Open training</button>
            </div>
          </section>
          <section className="card month-stats">
            <div><strong>{stats.logged}</strong><span>days with meals</span></div>
            <div><strong>{stats.workouts}</strong><span>workouts</span></div>
            <div><strong>{stats.missed}</strong><span>missed</span></div>
          </section>
        </aside>
      </div>
    </div>
  )
}
