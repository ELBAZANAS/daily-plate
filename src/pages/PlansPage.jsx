import { useState } from 'react'
import { seedPlans } from '../data/plans.js'
import { exerciseById } from '../data/exercises.js'
import { useStore } from '../store.jsx'
import { useRoute } from '../router.jsx'
import { newId } from '../lib/nutrition.js'
import { weekdayShort } from '../components/DateStepper.jsx'
import { Icon } from '../components/Icon.jsx'
import { Banner, ConfirmButton, Empty, NumberInput, PageHead } from '../components/ui.jsx'
import { ExerciseDetail, ExerciseImage, ExercisePickerModal } from '../components/Exercises.jsx'
import { useSortable } from '../components/Sortable.jsx'

const weekOrder = [1, 2, 3, 4, 5, 6, 0]

const byWeek = (a, b) => weekOrder.indexOf(a.weekday) - weekOrder.indexOf(b.weekday)

// Days keep their place in the week; dragging a workout moves it onto another day's slot.
function reorderDays(days, orderIds) {
  const slots = days.map((day) => day.weekday)
  const byId = new Map(days.map((day) => [day.id, day]))
  return orderIds.map((id, index) => ({ ...byId.get(id), weekday: slots[index] }))
}

// Stable keys for exercise slots, so a slot keeps its identity while it moves.
function slotKeys(exercises) {
  const seen = new Map()
  return exercises.map((slot) => {
    const count = seen.get(slot.exerciseId) || 0
    seen.set(slot.exerciseId, count + 1)
    return `${slot.exerciseId}#${count}`
  })
}

export function PlansPage() {
  const { state, savePlan, flash } = useStore()
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)

  if (editing) {
    return <PlanEditor plan={editing} onCancel={() => setEditing(null)} onSave={(plan) => { savePlan(plan); setEditing(null); flash('Plan saved') }} />
  }

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Training" title="Plans"
        actions={(
          <>
            <button className="btn ghost" type="button" onClick={() => {
              let added = 0
              for (const plan of seedPlans()) {
                if (!state.plans.some((item) => item.id === plan.id)) {
                  savePlan(plan)
                  added += 1
                }
              }
              flash(added ? `Restored ${added} starter plan${added === 1 ? '' : 's'}` : 'The starter plans are all here')
            }}><Icon name="repeat" size={16} />Restore starters</button>
            <button className="btn primary" type="button" onClick={() => setEditing({ id: newId(), name: 'My plan', description: '', days: [{ id: newId(), name: 'Day 1', weekday: 1, exercises: [] }] })}><Icon name="plus" size={16} />New plan</button>
          </>
        )}>
        <p className="muted">Start from a template, then change days and exercises until they fit your week.</p>
      </PageHead>

      {state.plans.length === 0 && <div className="card"><Empty icon="plans" title="No plans yet">Create one, or restore the three starter plans.</Empty></div>}

      {state.plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(structuredClone(plan))} onDetail={setDetail} />
      ))}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function PlanCard({ plan, onEdit, onDetail }) {
  const { state, savePlan, deletePlan, applySchedule, flash, setPendingStart, draft } = useStore()
  const { go } = useRoute()
  const schedule = state.profile.workoutDays || []
  const days = [...plan.days].sort(byWeek)
  const sameDays = days.length > 0 && days.every((day) => schedule.includes(day.weekday)) && schedule.length === new Set(days.map((day) => day.weekday)).size
  const inUse = sameDays && (state.profile.activePlanId ? state.profile.activePlanId === plan.id : true)
  const daySort = useSortable({
    ids: days.map((day) => day.id),
    axis: 'wrap',
    onReorder: (order) => savePlan({ ...plan, days: reorderDays(days, order) }),
  })
  const shown = daySort.order.map((id) => days.find((day) => day.id === id)).filter(Boolean)
  const slotWeekdays = days.map((day) => day.weekday)

  return (
    <article className="card plan-card">
      <header className="plan-head">
        <div>
          <h2>{plan.name}{state.profile.activePlanId === plan.id && <span className="active-badge">Current plan</span>}</h2>
          {plan.description && <p className="muted">{plan.description}</p>}
        </div>
        <div className="week-strip" aria-label="Training weekdays">
          {weekOrder.map((day) => <span key={day} className={days.some((item) => item.weekday === day) ? 'on' : ''}>{weekdayShort[day][0]}</span>)}
        </div>
      </header>
      {days.length > 1 && <p className="muted tiny drag-tip"><Icon name="grip" size={14} />Drag a workout to move it to another day, or drag exercises to change their order.</p>}
      <div className="plan-days">
        {shown.map((day, index) => (
          <div key={day.id} {...daySort.itemProps(day.id, 'plan-day')}>
            <div className="plan-day-head">
              {days.length > 1 && <button {...daySort.handleProps(day.id, day.name)}><Icon name="grip" size={16} /></button>}
              <span className="day-badge">{weekdayShort[daySort.sorting ? slotWeekdays[index] : day.weekday]}</span>
              <strong>{day.name}</strong>
              <button className="btn ghost small push" type="button" disabled={Boolean(draft) || !day.exercises.length} title={draft ? 'A workout is already in progress' : ''} onClick={() => { setPendingStart({ planId: plan.id, dayId: day.id }); go('train') }}><Icon name="play" size={14} />Train</button>
            </div>
            <ChipRow day={day} onDetail={onDetail} onReorder={(exercises) => savePlan({ ...plan, days: plan.days.map((item) => (item.id === day.id ? { ...item, exercises } : item)) })} />
          </div>
        ))}
      </div>
      <footer className="row gap wrap">
        <button className={`btn small ${inUse ? 'soft' : 'primary'}`} type="button" disabled={inUse || !days.length} onClick={() => { applySchedule(days.map((day) => day.weekday), plan.id); flash(`${plan.name} is now your plan`) }}>
          <Icon name={inUse ? 'check' : 'calendar'} size={15} />{inUse ? 'Your current plan' : 'Use this plan'}
        </button>
        <button className="btn ghost small" type="button" onClick={onEdit}><Icon name="edit" size={15} />Edit</button>
        <button className="btn ghost small" type="button" onClick={() => {
          const copy = structuredClone(plan)
          copy.id = newId()
          copy.name = `${plan.name} (copy)`
          copy.days.forEach((day) => { day.id = newId() })
          savePlan(copy)
          flash('Plan copied')
        }}><Icon name="copy" size={15} />Duplicate</button>
        <ConfirmButton icon="trash" confirmText="Delete plan?" onConfirm={() => deletePlan(plan.id)}>Delete</ConfirmButton>
      </footer>
    </article>
  )
}

function ChipRow({ day, onDetail, onReorder }) {
  const keys = slotKeys(day.exercises)
  const byKey = new Map(keys.map((key, index) => [key, day.exercises[index]]))
  const sort = useSortable({ ids: keys, axis: 'y', activation: 'press', onReorder: (order) => onReorder(order.map((key) => byKey.get(key))) })
  if (!day.exercises.length) return <div className="thumb-row"><span className="muted small">No exercises yet</span></div>
  return (
    <div className="thumb-row">
      {sort.order.map((key) => {
        const slot = byKey.get(key)
        const info = exerciseById(slot.exerciseId)
        const { className, ...item } = sort.itemProps(key)
        return (
          <button key={key} {...item} {...sort.pressProps(key)} type="button" className={`thumb-chip ${className}`}
            onClick={() => info && onDetail(info)}
            onKeyDown={(event) => {
              if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
              event.preventDefault()
              sort.moveBy(key, event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)
            }}
            title={`${info?.title || 'Missing'} — drag to reorder (or Alt + arrow keys)`}>
            <ExerciseImage exercise={info} className="thumb sm" />
            <span>{info?.title || 'Missing'}<small>{slot.sets}×{slot.reps}</small></span>
          </button>
        )
      })}
    </div>
  )
}

function PlanEditor({ plan, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({
    ...plan,
    days: [...plan.days].sort(byWeek).map((day) => ({ ...day, exercises: day.exercises.map((slot) => ({ ...slot, _key: newId() })) })),
  }))
  const [picking, setPicking] = useState(null)
  const [error, setError] = useState('')

  const daySort = useSortable({
    ids: draft.days.map((day) => day.id),
    axis: 'y',
    onReorder: (order) => setDraft((current) => ({ ...current, days: reorderDays(current.days, order) })),
  })

  function patchDay(id, recipe) {
    setDraft((current) => ({ ...current, days: current.days.map((day) => (day.id === id ? recipe(day) : day)) }))
  }

  function save() {
    for (const day of draft.days) {
      if (!day.name.trim()) return setError('Every day needs a name.')
      for (const slot of day.exercises) {
        const sets = Number(slot.sets)
        if (!Number.isInteger(sets) || sets < 1 || sets > 20) return setError(`${day.name}: sets must be a whole number from 1 to 20.`)
        if (!String(slot.reps).trim()) return setError(`${day.name}: every exercise needs a rep target, like 8-12.`)
        const rest = Number(slot.restSec)
        if (!Number.isFinite(rest) || rest < 0 || rest > 900) return setError(`${day.name}: rest must be 0 to 900 seconds.`)
      }
    }
    setError('')
    onSave({
      ...draft,
      name: draft.name.trim() || 'Untitled plan',
      description: draft.description.trim(),
      days: draft.days.map((day) => ({
        ...day,
        name: day.name.trim(),
        exercises: day.exercises.map(({ _key, ...slot }) => ({ ...slot, sets: Number(slot.sets), reps: String(slot.reps).trim(), restSec: Number(slot.restSec) })),
      })),
    })
  }

  const used = draft.days.map((day) => day.weekday)
  const clash = used.length !== new Set(used).size
  const shown = daySort.order.map((id) => draft.days.find((day) => day.id === id)).filter(Boolean)

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Edit plan" title={draft.name || 'Untitled plan'}
        actions={<><button className="btn ghost" type="button" onClick={onCancel}>Cancel</button><button className="btn primary" type="button" onClick={save}><Icon name="check" size={16} />Save plan</button></>} />
      <section className="card stack">
        <div className="grid-2">
          <label className="field"><span className="field-label">Plan name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="field"><span className="field-label">Description</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What it is for, how to run it" /></label>
        </div>
      </section>
      {error && <Banner tone="bad">{error}</Banner>}
      {clash && <Banner tone="warn">Two days share a weekday. That works if you train twice that day; otherwise pick another weekday.</Banner>}
      <p className="muted small drag-tip"><Icon name="grip" size={15} />Drag the handles to reorder. Moving a whole day keeps the weekdays in place and swaps the workouts onto them.</p>
      <div className="stack-lg">
        {shown.map((day, index) => (
          <article key={day.id} {...daySort.itemProps(day.id, 'card stack day-card')}>
            <div className="day-edit-head">
              {draft.days.length > 1 && <button {...daySort.handleProps(day.id, day.name || 'day')}><Icon name="grip" size={18} /></button>}
              <label className="field grow"><span className="field-label">Day name</span><input value={day.name} onChange={(event) => patchDay(day.id, (item) => ({ ...item, name: event.target.value }))} /></label>
              <label className="field"><span className="field-label">Weekday</span>
                <select value={daySort.sorting ? draft.days[index]?.weekday ?? day.weekday : day.weekday} onChange={(event) => patchDay(day.id, (item) => ({ ...item, weekday: Number(event.target.value) }))}>
                  {weekOrder.map((weekday) => <option key={weekday} value={weekday}>{weekdayShort[weekday]}</option>)}
                </select>
              </label>
              <ConfirmButton icon="trash" confirmText="Remove day?" onConfirm={() => setDraft((current) => ({ ...current, days: current.days.filter((item) => item.id !== day.id) }))}>Remove day</ConfirmButton>
            </div>
            <SlotList day={day} onPatch={(recipe) => patchDay(day.id, recipe)} />
            <button className="btn soft small self-start" type="button" onClick={() => setPicking(day.id)}><Icon name="plus" size={15} />Add exercise</button>
          </article>
        ))}
      </div>
      <button className="btn ghost self-start" type="button" onClick={() => {
        const free = weekOrder.find((index) => !used.includes(index))
        setDraft((current) => ({ ...current, days: [...current.days, { id: newId(), name: `Day ${current.days.length + 1}`, weekday: free ?? 1, exercises: [] }] }))
      }}><Icon name="plus" size={16} />Add a day</button>
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="row end gap">
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="button" onClick={save}><Icon name="check" size={16} />Save plan</button>
      </div>
      {picking && (
        <ExercisePickerModal title="Add to this day" onClose={() => setPicking(null)} onPick={(exercise) => {
          patchDay(picking, (item) => ({ ...item, exercises: [...item.exercises, { exerciseId: exercise.id, sets: 3, reps: exercise.logging === 'cardio' ? '10' : '8-12', restSec: exercise.logging === 'cardio' ? 0 : 90, _key: newId() }] }))
          setPicking(null)
        }} />
      )}
    </div>
  )
}

function SlotList({ day, onPatch }) {
  const sort = useSortable({
    ids: day.exercises.map((slot) => slot._key),
    axis: 'y',
    onReorder: (order) => onPatch((item) => ({ ...item, exercises: order.map((key) => item.exercises.find((slot) => slot._key === key)).filter(Boolean) })),
  })
  if (!day.exercises.length) return <p className="muted">No exercises on this day yet.</p>
  const patchSlot = (key, values) => onPatch((item) => ({ ...item, exercises: item.exercises.map((slot) => (slot._key === key ? { ...slot, ...values } : slot)) }))
  return (
    <div className="slot-list">
      {sort.order.map((key) => {
        const slot = day.exercises.find((item) => item._key === key)
        if (!slot) return null
        const info = exerciseById(slot.exerciseId)
        const title = info?.title || 'Missing exercise'
        return (
          <div key={key} {...sort.itemProps(key, 'slot-edit')}>
            {day.exercises.length > 1 && <button {...sort.handleProps(key, title)}><Icon name="grip" size={18} /></button>}
            <ExerciseImage exercise={info} className="thumb" />
            <div className="slot-edit-main">
              <strong>{title}</strong>
              <div className="slot-fields">
                <label className="field"><span className="field-label">Sets</span><NumberInput value={String(slot.sets)} onChange={(value) => patchSlot(key, { sets: value })} /></label>
                <label className="field"><span className="field-label">{info?.amountLabel === 'reps' || !info ? 'Reps' : info.amountLabel === 'sec' ? 'Seconds' : 'Minutes'}</span><input value={slot.reps} onChange={(event) => patchSlot(key, { reps: event.target.value })} placeholder="8-12" /></label>
                <label className="field"><span className="field-label">Rest (s)</span><NumberInput value={String(slot.restSec)} onChange={(value) => patchSlot(key, { restSec: value })} /></label>
              </div>
            </div>
            <div className="slot-actions">
              <button className="icon-btn danger" type="button" aria-label={`Remove ${title}`} onClick={() => onPatch((item) => ({ ...item, exercises: item.exercises.filter((entry) => entry._key !== key) }))}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
