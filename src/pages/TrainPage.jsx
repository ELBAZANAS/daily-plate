import { useEffect, useMemo, useRef, useState } from 'react'
import { exerciseById } from '../data/exercises.js'
import { useStore } from '../store.jsx'
import { useRoute } from '../router.jsx'
import { newId } from '../lib/nutrition.js'
import { prettyDate } from '../lib/dates.js'
import { formatClock, nextLoad, previousSets, recordsSetBy, sessionSetCount, sessionVolume } from '../lib/training.js'
import { formatWeight, kgToLb, lbToKg, round1 } from '../lib/units.js'
import { Icon } from '../components/Icon.jsx'
import { Banner, ConfirmButton, Empty, Modal, NumberInput, PageHead } from '../components/ui.jsx'
import { useSortable } from '../components/Sortable.jsx'
import { ExerciseDetail, ExerciseImage, ExercisePickerModal, formatSet } from '../components/Exercises.jsx'
import { plannedDays } from './TodayPage.jsx'

function emptySet(weight = '') {
  return { id: newId(), reps: '', weight, done: false }
}

function slotFor(exercise) {
  return {
    id: newId(),
    exerciseId: exercise.id,
    targetReps: exercise.logging === 'cardio' ? '10' : '8-12',
    restSec: exercise.logging === 'cardio' ? 0 : 90,
    sets: [emptySet()],
  }
}

function toUnit(kg, units) {
  if (!(kg > 0)) return ''
  return String(units === 'imperial' ? Math.round(kgToLb(kg) * 10) / 10 : round1(kg))
}

export function TrainPage() {
  const { state, draft, setDraft, viewDate, saveSession, deleteSession, flash, pendingStart, setPendingStart } = useStore()
  const { go } = useRoute()
  const [detail, setDetail] = useState(null)
  const units = state.profile.units

  function baseDraft(extra) {
    return {
      id: newId(),
      date: viewDate,
      name: 'Workout',
      startedAt: new Date().toISOString(),
      weightUnit: units,
      notes: '',
      exercises: [],
      ...extra,
    }
  }

  function startDay(plan, day) {
    setDraft(baseDraft({
      name: `${plan.name} · ${day.name}`,
      planId: plan.id,
      dayId: day.id,
      exercises: day.exercises.filter((slot) => exerciseById(slot.exerciseId)).map((slot) => ({
        id: newId(),
        exerciseId: slot.exerciseId,
        targetReps: slot.reps,
        restSec: slot.restSec,
        sets: Array.from({ length: Math.max(1, Math.min(20, Number(slot.sets) || 1)) }, () => emptySet()),
      })),
    }))
  }

  function repeat(session) {
    const plan = state.plans.find((item) => item.id === session.planId)
    const day = plan?.days.find((item) => item.id === session.dayId)
    setDraft(baseDraft({
      name: session.name,
      planId: session.planId || null,
      dayId: session.dayId || null,
      exercises: session.exercises.filter((item) => exerciseById(item.exerciseId)).map((item) => {
        const info = exerciseById(item.exerciseId)
        const planned = day?.exercises.find((slot) => slot.exerciseId === item.exerciseId)
        return {
          id: newId(),
          exerciseId: item.exerciseId,
          targetReps: planned?.reps || (info.logging === 'cardio' ? '10' : '8-12'),
          restSec: planned?.restSec ?? (info.logging === 'cardio' ? 0 : 90),
          sets: item.sets.map((set) => emptySet(toUnit(set.weightKg, units))),
        }
      }),
    }))
    flash('Workout started from your last session')
  }

  useEffect(() => {
    if (!pendingStart) return
    if (draft) {
      flash('Finish or discard the workout in progress first.')
      setPendingStart(null)
      return
    }
    const plan = state.plans.find((item) => item.id === pendingStart.planId)
    const day = plan?.days.find((item) => item.id === pendingStart.dayId)
    if (plan && day) startDay(plan, day)
    else if (pendingStart.exerciseId && exerciseById(pendingStart.exerciseId)) setDraft(baseDraft({ exercises: [slotFor(exerciseById(pendingStart.exerciseId))] }))
    setPendingStart(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStart])

  if (draft) {
    return <Logger key={draft.id} />
  }

  const planned = plannedDays(state, viewDate)
  const sessions = state.sessions.filter((session) => session.date === viewDate)
  const recent = []
  for (const session of [...state.sessions].reverse()) {
    if (recent.some((item) => item.name === session.name)) continue
    recent.push(session)
    if (recent.length >= 4) break
  }

  return (
    <div className="page stack-lg">
      <PageHead eyebrow={prettyDate(viewDate, { weekday: 'long', month: 'long', day: 'numeric' })} title="Training"
        actions={<button className="btn ghost" type="button" onClick={() => go('exercises')}><Icon name="grid" size={16} />Exercise library</button>} />

      <section className="stack">
        <h2 className="section-title">Planned for this day</h2>
        {planned.length === 0 ? (
          <div className="card"><Empty icon="calendar" title="No plan day lands on this weekday">Start an empty workout, repeat a recent one, or set the weekdays in <button className="link-btn inline" type="button" onClick={() => go('plans')}>Plans</button>.</Empty></div>
        ) : (
          <div className="plan-cards">
            {planned.map(({ plan, day }) => (
              <article key={day.id} className="card plan-day-card">
                <div className="plan-day-top">
                  <div>
                    <p className="eyebrow">{plan.name}</p>
                    <h3>{day.name}</h3>
                    <p className="muted small">{day.exercises.length} exercises · {day.exercises.reduce((sum, slot) => sum + (Number(slot.sets) || 0), 0)} sets</p>
                  </div>
                  <button className="btn primary" type="button" onClick={() => startDay(plan, day)}><Icon name="play" size={15} />Start</button>
                </div>
                <ul className="slot-list">
                  {day.exercises.map((slot, index) => {
                    const info = exerciseById(slot.exerciseId)
                    return (
                      <li key={`${slot.exerciseId}-${index}`}>
                        <button type="button" className="slot-line" onClick={() => info && setDetail(info)}>
                          <ExerciseImage exercise={info} className="thumb sm" />
                          <span>{info?.title || 'Missing exercise'}</span>
                          <small className="muted">{slot.sets} × {slot.reps}</small>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </article>
            ))}
          </div>
        )}
        <div className="toolbar">
          <button className="btn soft" type="button" onClick={() => setDraft(baseDraft())}><Icon name="plus" size={16} />Start an empty workout</button>
        </div>
      </section>

      {sessions.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Logged this day</h2>
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} units={units} onRepeat={() => repeat(session)} onDelete={() => deleteSession(session.id)} />
          ))}
        </section>
      )}

      {recent.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Repeat a recent workout</h2>
          <div className="recent-grid">
            {recent.map((session) => (
              <button key={session.id} type="button" className="card recent-card" onClick={() => repeat(session)}>
                <span className="recent-icon"><Icon name="repeat" /></span>
                <span>
                  <strong>{session.name}</strong>
                  <small className="muted">{prettyDate(session.date)} · {session.exercises.length} exercises · {sessionSetCount(session)} sets</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} onAdd={() => {
        const exercise = detail
        setDraft((current) => ({ ...(current || baseDraft()), exercises: [...(current?.exercises || []), slotFor(exercise)] }))
        setDetail(null)
      }} addLabel="Start a workout with it" />}
    </div>
  )
}

export function SessionCard({ session, units, onRepeat, onDelete }) {
  const [open, setOpen] = useState(false)
  const volume = sessionVolume(session)
  return (
    <article className="card session-card">
      <div className="session-top">
        <button type="button" className="session-title" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span className="tile-icon tone-train"><Icon name="dumbbell" /></span>
          <span>
            <strong>{session.name}</strong>
            <small className="muted">{session.minutes || 0} min · {session.exercises.length} exercises · {sessionSetCount(session)} sets{volume ? ` · ${Math.round(units === 'imperial' ? kgToLb(volume) : volume).toLocaleString()} ${units === 'imperial' ? 'lb' : 'kg'} total` : ''}</small>
          </span>
          <Icon name={open ? 'up' : 'down'} size={16} />
        </button>
        <div className="row gap">
          {onRepeat && <button className="btn ghost small" type="button" onClick={onRepeat}><Icon name="repeat" size={15} />Repeat</button>}
          <ConfirmButton icon="trash" confirmText="Delete?" onConfirm={onDelete}>Delete</ConfirmButton>
        </div>
      </div>
      {open && (
        <ul className="session-lines">
          {session.exercises.map((exercise) => {
            const info = exerciseById(exercise.exerciseId)
            return (
              <li key={exercise.id}>
                <strong>{info?.title || 'Exercise'}</strong>
                <span className="muted">{exercise.sets.map((set) => formatSet(set, info, units)).join(' · ')}</span>
              </li>
            )
          })}
          {session.notes && <li className="session-note"><Icon name="note" size={15} />{session.notes}</li>}
        </ul>
      )}
    </article>
  )
}

function beep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const times = [0, 0.22, 0.44]
    for (const at of times) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = at === 0.44 ? 1046 : 784
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.2)
    }
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // Sound is optional.
  }
  navigator.vibrate?.([120, 80, 120])
}

function Logger() {
  const { state, draft, setDraft, saveSession, flash } = useStore()
  const [now, setNow] = useState(Date.now())
  const [picking, setPicking] = useState(!draft.exercises.length)
  const [detail, setDetail] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  // A rest that already ended while you were on another page does not beep when you come back.
  const restDone = useRef(Boolean(draft.rest && draft.rest.until <= Date.now()))
  const units = draft.weightUnit || 'metric'
  const unitLabel = units === 'imperial' ? 'lb' : 'kg'

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  // The rest countdown is part of the saved workout, so it keeps running while you look at another page.
  const rest = draft.rest || null
  const setRest = (value) => patch((current) => ({ ...current, rest: typeof value === 'function' ? value(current.rest || null) : value }))
  useEffect(() => {
    if (draft.rest && draft.rest.until < Date.now() - 2500) setRest(null)
    // Only when the workout screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restLeft = rest ? Math.max(0, rest.until - now) : 0
  useEffect(() => {
    if (!rest) return
    if (restLeft === 0 && !restDone.current) {
      restDone.current = true
      beep()
      const id = setTimeout(() => setRest(null), 2500)
      return () => clearTimeout(id)
    }
    return undefined
  }, [rest, restLeft])

  function startRest(seconds) {
    if (!(seconds > 0)) return
    restDone.current = false
    setRest({ until: Date.now() + seconds * 1000, total: seconds })
  }

  function shiftRest(seconds) {
    restDone.current = false
    setRest((current) => {
      if (!current) return current
      const until = Math.max(Date.now() + 1000, current.until + seconds * 1000)
      return { until, total: Math.max(current.total, Math.round((until - Date.now()) / 1000)) }
    })
  }

  const elapsed = Math.max(0, now - new Date(draft.startedAt).getTime())

  function patch(recipe) {
    setDraft((current) => (current ? recipe(current) : current))
  }

  function patchExercise(slotId, recipe) {
    patch((current) => ({ ...current, exercises: current.exercises.map((item) => (item.id === slotId ? recipe(item) : item)) }))
  }

  const exerciseSort = useSortable({
    ids: draft.exercises.map((item) => item.id),
    axis: 'y',
    onReorder: (order) => patch((current) => ({ ...current, exercises: order.map((id) => current.exercises.find((item) => item.id === id)).filter(Boolean) })),
  })

  function buildSession() {
    const exercises = draft.exercises.map((exercise) => ({
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set) => {
        const reps = Number(set.reps)
        const weight = Number(set.weight)
        return {
          id: set.id,
          reps: Number.isFinite(reps) && reps > 0 ? Math.round(reps * 100) / 100 : 0,
          weightKg: Number.isFinite(weight) && weight > 0 ? Math.round((units === 'imperial' ? lbToKg(weight) : weight) * 100) / 100 : 0,
        }
      }).filter((set) => set.reps > 0),
    })).filter((exercise) => exercise.sets.length)
    return {
      id: draft.id,
      date: draft.date,
      name: draft.name.trim() || 'Workout',
      planId: draft.planId || null,
      dayId: draft.dayId || null,
      startedAt: draft.startedAt,
      notes: (draft.notes || '').trim(),
      minutes: Math.max(1, Math.round(elapsed / 60000)),
      exercises,
    }
  }

  function finish() {
    const bad = draft.exercises.some((exercise) => exercise.sets.some((set) => (set.reps !== '' && !(Number(set.reps) >= 0)) || (set.weight !== '' && !(Number(set.weight) >= 0))))
    if (bad) {
      setError('One of the sets has something that is not a number. Fix it, then finish.')
      return
    }
    const session = buildSession()
    if (!session.exercises.length) {
      setError('Enter reps (or minutes / seconds) for at least one set before finishing.')
      return
    }
    setError('')
    setSummary({ session, records: recordsSetBy(session, state.sessions) })
  }

  const totals = useMemo(() => {
    let done = 0
    let all = 0
    for (const exercise of draft.exercises) for (const set of exercise.sets) { all += 1; if (set.done) done += 1 }
    return { done, all }
  }, [draft.exercises])

  return (
    <div className="page stack-lg logger">
      <div className="logger-bar card">
        <div className="logger-title">
          <input className="title-input" aria-label="Workout name" value={draft.name} onChange={(event) => patch((current) => ({ ...current, name: event.target.value }))} />
          <p className="muted small"><Icon name="clock" size={14} /> {formatClock(elapsed)} · {totals.done}/{totals.all} sets done · {prettyDate(draft.date)} · weights in {unitLabel}</p>
        </div>
        <div className="row gap">
          <button className="btn primary" type="button" onClick={finish}><Icon name="check" size={16} />Finish</button>
        </div>
      </div>

      {rest && (
        <div className={`rest-bar ${restLeft === 0 ? 'done' : ''}`} role="timer" aria-live="polite">
          <div className="rest-fill" style={{ width: `${rest.total ? (restLeft / (rest.total * 1000)) * 100 : 0}%` }} />
          <Icon name="timer" />
          <strong>{restLeft === 0 ? 'Rest over — next set' : `Rest ${formatClock(restLeft + 999)}`}</strong>
          <div className="row gap">
            <button className="btn ghost small" type="button" onClick={() => shiftRest(-15)}>−15s</button>
            <button className="btn ghost small" type="button" onClick={() => shiftRest(15)}>+15s</button>
            <button className="btn ghost small" type="button" onClick={() => setRest(null)}>Skip</button>
          </div>
        </div>
      )}

      {error && <Banner tone="bad">{error}</Banner>}

      {draft.exercises.length === 0 && (
        <div className="card"><Empty icon="dumbbell" title="No exercises yet" action={<button className="btn primary" type="button" onClick={() => setPicking(true)}><Icon name="plus" size={16} />Add an exercise</button>}>Add the first exercise to start logging sets.</Empty></div>
      )}

      <div className="stack-lg">
      {exerciseSort.order.map((id) => {
        const slot = draft.exercises.find((item) => item.id === id)
        const info = slot && exerciseById(slot.exerciseId)
        if (!info) return null
        return (
          <ExerciseLog
            key={slot.id}
            slot={slot}
            info={info}
            sortItem={exerciseSort.itemProps(slot.id, 'card ex-log')}
            sortHandle={draft.exercises.length > 1 ? exerciseSort.handleProps(slot.id, info.title) : null}
            units={units}
            unitLabel={unitLabel}
            previous={previousSets(state.sessions, info.id, draft.date, draft.id)}
            onPatch={(recipe) => patchExercise(slot.id, recipe)}
            onRemove={() => patch((current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== slot.id) }))}
            onInfo={() => setDetail(info)}
            onRest={startRest}
          />
        )
      })}
      </div>

      <div className="toolbar">
        <button className="btn soft" type="button" onClick={() => setPicking(true)}><Icon name="plus" size={16} />Add exercise</button>
      </div>

      <label className="field card">
        <span className="field-label"><Icon name="note" size={15} /> Notes</span>
        <textarea rows="3" value={draft.notes || ''} placeholder="How did it feel? Sleep, energy, anything to remember next time." onChange={(event) => patch((current) => ({ ...current, notes: event.target.value }))} />
      </label>

      <div className="row spread wrap">
        <ConfirmButton className="btn danger-ghost" icon="trash" confirmText="Discard this workout?" onConfirm={() => { setDraft(null); flash('Workout discarded') }}>Discard workout</ConfirmButton>
        <button className="btn primary" type="button" onClick={finish}><Icon name="check" size={16} />Finish workout</button>
      </div>

      {picking && (
        <ExercisePickerModal onClose={() => setPicking(false)} onPick={(exercise) => {
          patch((current) => ({ ...current, exercises: [...current.exercises, slotFor(exercise)] }))
          setPicking(false)
          flash(`${exercise.title} added`)
        }} />
      )}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
      {summary && (
        <FinishSummary
          summary={summary}
          units={units}
          onBack={() => setSummary(null)}
          onSave={() => {
            saveSession(summary.session)
            setDraft(null)
            flash(summary.records.length ? `Workout saved · ${summary.records.length} new personal best${summary.records.length === 1 ? '' : 's'}` : 'Workout saved')
          }}
        />
      )}
    </div>
  )
}

function ExerciseLog({ slot, info, sortItem, sortHandle, units, unitLabel, previous, onPatch, onRemove, onInfo, onRest }) {
  const [settings, setSettings] = useState(false)
  const cardio = info.logging === 'cardio'
  const suggestion = info.logging === 'strength' && info.amountLabel === 'reps' ? nextLoad(previous, slot.targetReps, units) : null
  const suggestionText = suggestion ? (units === 'imperial' ? `${Math.round(kgToLb(suggestion))} lb` : `${round1(suggestion)} kg`) : ''

  function setPatch(setId, values) {
    onPatch((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...values } : set)) }))
  }

  function toggleDone(set, setIndex) {
    if (!set.done) {
      const before = previous[setIndex] || previous.at(-1)
      const above = slot.sets.slice(0, setIndex).reverse().find((item) => item.reps !== '' || item.weight !== '')
      const fill = {}
      if (set.reps === '') {
        const targetLow = (String(slot.targetReps).match(/\d+/) || [''])[0]
        const reps = above?.reps || (before ? String(before.reps) : targetLow)
        if (reps !== '') fill.reps = reps
      }
      if (set.weight === '' && !cardio) {
        const weight = above?.weight || (before ? toUnit(before.weightKg, units) : '')
        if (weight !== '') fill.weight = weight
      }
      const reps = fill.reps ?? set.reps
      if (reps === '' || !(Number(reps) > 0)) {
        setPatch(set.id, { ...fill })
        return
      }
      setPatch(set.id, { ...fill, done: true })
      onRest(slot.restSec)
    } else {
      setPatch(set.id, { done: false })
    }
  }

  return (
    <article {...sortItem}>
      <header className="ex-log-head">
        {sortHandle && <button {...sortHandle}><Icon name="grip" size={18} /></button>}
        <button type="button" className="ex-log-title" onClick={onInfo} title="How to do it">
          <ExerciseImage exercise={info} className="thumb" />
          <span>
            <strong>{info.title}</strong>
            <small className="muted">Target {slot.targetReps} {info.amountLabel}{slot.restSec ? ` · rest ${slot.restSec}s` : ''}</small>
          </span>
        </button>
        <div className="row gap-xs">
          <button className={`icon-btn ${settings ? 'on' : ''}`} type="button" aria-label="Target and rest" aria-expanded={settings} onClick={() => setSettings((value) => !value)}><Icon name="settings" size={16} /></button>
        </div>
      </header>

      {settings && (
        <div className="ex-settings">
          <label className="field"><span className="field-label">Target {info.amountLabel}</span><input value={slot.targetReps} onChange={(event) => onPatch((exercise) => ({ ...exercise, targetReps: event.target.value }))} placeholder="8-12" /></label>
          <label className="field"><span className="field-label">Rest (seconds)</span><NumberInput value={String(slot.restSec ?? '')} onChange={(value) => onPatch((exercise) => ({ ...exercise, restSec: Math.max(0, Math.min(900, Math.round(Number(value) || 0))) }))} /></label>
          <ConfirmButton className="btn danger-ghost small" icon="trash" confirmText="Remove?" onConfirm={onRemove}>Remove exercise</ConfirmButton>
        </div>
      )}

      {(previous.length > 0 || suggestion) && (
        <div className="ex-hints">
          {previous.length > 0 && <span className="muted small">Last time: {previous.map((set) => formatSet(set, info, units)).join(', ')}</span>}
          {suggestion && (
            <button className="hint-btn" type="button" onClick={() => onPatch((exercise) => ({
              ...exercise,
              sets: exercise.sets.map((set) => (set.done ? set : { ...set, weight: units === 'imperial' ? String(Math.round(kgToLb(suggestion))) : String(round1(suggestion)) })),
            }))}>
              <Icon name="bolt" size={14} />You hit the top of the range — try {suggestionText}
            </button>
          )}
        </div>
      )}

      <div className={`set-grid ${cardio ? 'cardio' : ''}`} aria-label={`${info.title} sets`}>
        <div className="set-head">
          <span>Set</span>
          <span>Previous</span>
          {!cardio && <span>{unitLabel}</span>}
          <span>{info.amountLabel}</span>
          <span className="center">Done</span>
          <span aria-label="Remove" />
        </div>
        {slot.sets.map((set, setIndex) => {
          const before = previous[setIndex]
          return (
            <div key={set.id} className={`set-row ${set.done ? 'done' : ''}`}>
              <span className="set-num">{setIndex + 1}</span>
              <span className="set-prev muted">{before ? formatSet(before, info, units) : '—'}</span>
              {!cardio && (
                <NumberInput aria-label={`Set ${setIndex + 1} weight in ${unitLabel}`} value={set.weight} placeholder={before?.weightKg > 0 ? toUnit(before.weightKg, units) : '0'} onChange={(value) => setPatch(set.id, { weight: value })} />
              )}
              <NumberInput aria-label={`Set ${setIndex + 1} ${info.amountLabel}`} value={set.reps} placeholder={before ? String(before.reps) : String(slot.targetReps).split(/[-–]/)[0] || '0'} onChange={(value) => setPatch(set.id, { reps: value })} />
              <button className={`check ${set.done ? 'on' : ''}`} type="button" onClick={() => toggleDone(set, setIndex)} aria-label={`Mark set ${setIndex + 1} ${set.done ? 'not done' : 'done'}`} aria-pressed={set.done}><Icon name="check" size={16} /></button>
              <button className="icon-btn subtle" type="button" aria-label={`Remove set ${setIndex + 1}`} disabled={slot.sets.length === 1} onClick={() => onPatch((exercise) => ({ ...exercise, sets: exercise.sets.filter((item) => item.id !== set.id) }))}><Icon name="x" size={15} /></button>
            </div>
          )
        })}
      </div>
      <div className="row gap wrap">
        <button className="btn ghost small" type="button" onClick={() => onPatch((exercise) => ({ ...exercise, sets: [...exercise.sets, emptySet(exercise.sets.at(-1)?.weight || '')] }))}><Icon name="plus" size={15} />Add set</button>
        {slot.restSec > 0 && <button className="btn ghost small" type="button" onClick={() => onRest(slot.restSec)}><Icon name="timer" size={15} />Rest {slot.restSec}s</button>}
      </div>
    </article>
  )
}

function FinishSummary({ summary, units, onBack, onSave }) {
  const { session, records } = summary
  const volume = sessionVolume(session)
  return (
    <Modal title="Nice work" subtitle={session.name} onClose={onBack} size="sm"
      footer={<div className="row end wide"><button className="btn ghost" type="button" onClick={onBack}>Keep logging</button><button className="btn primary" type="button" data-autofocus onClick={onSave}><Icon name="check" size={16} />Save workout</button></div>}>
      <div className="stack">
        <div className="summary-stats">
          <div><strong>{session.minutes}</strong><span>min</span></div>
          <div><strong>{session.exercises.length}</strong><span>exercises</span></div>
          <div><strong>{sessionSetCount(session)}</strong><span>sets</span></div>
          <div><strong>{Math.round(units === 'imperial' ? kgToLb(volume) : volume).toLocaleString()}</strong><span>{units === 'imperial' ? 'lb' : 'kg'} moved</span></div>
        </div>
        {records.length > 0 ? (
          <div className="pr-box">
            <Icon name="trophy" size={20} />
            <div>
              <strong>New personal best{records.length === 1 ? '' : 's'}</strong>
              <ul className="pr-list">
                {records.map((record) => {
                  const info = exerciseById(record.exerciseId)
                  return (
                    <li key={record.exerciseId}>
                      {info?.title}: {record.kind === 'e1rm' ? `${formatSet(record.set, info, units)} (est. 1RM ${formatWeight(record.value, units)})` : formatSet(record.set, info, units)}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        ) : <p className="muted">Sets with reps entered are saved. Empty sets are left out.</p>}
      </div>
    </Modal>
  )
}
