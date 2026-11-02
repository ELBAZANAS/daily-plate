import { useEffect, useMemo, useRef, useState } from 'react'
import { equipmentList, exerciseById, exercises as library, groupColors, muscleGroups } from '../data/exercises.js'
import { searchExercises } from '../lib/search.js'
import { exerciseHistory, personalRecords } from '../lib/training.js'
import { prettyDate } from '../lib/dates.js'
import { formatWeight } from '../lib/units.js'
import { useStore } from '../store.jsx'
import { Icon } from './Icon.jsx'
import { Modal, SearchField } from './ui.jsx'
import { MotionPlayer } from './MotionPlayer.jsx'

const PAGE = 48

export function ExerciseImage({ exercise, className = '', animated = false, controls = true }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [exercise?.id])
  if (exercise && animated) {
    return <MotionPlayer key={exercise.id} src={exercise.gif} poster={exercise.image} title={exercise.title} controls={controls} className={className} />
  }
  if (!exercise?.image || failed) {
    return <span className={`ex-img ex-img-empty ${className}`} aria-hidden="true"><Icon name="dumbbell" size={20} /></span>
  }
  return <img className={`ex-img ${className}`} src={exercise.image} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

export function GroupTag({ group }) {
  return <span className="group-tag" style={{ '--tag': groupColors[group] || 'var(--ink-3)' }}>{group}</span>
}

export function formatSet(set, exercise, units) {
  const amount = exercise?.amountLabel || 'reps'
  if (!exercise || exercise.logging === 'cardio' || !(set.weightKg > 0)) return `${set.reps} ${amount}`
  return `${formatWeight(set.weightKg, units)} × ${set.reps}`
}

export function ExerciseBrowser({ mode = 'library', onPick, onOpen, autoFocus = false }) {
  const { state } = useStore()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const [equipment, setEquipment] = useState('All')
  const [limit, setLimit] = useState(PAGE)

  const recentIds = useMemo(() => {
    const seen = []
    for (const session of [...state.sessions].reverse()) {
      for (const item of session.exercises) if (!seen.includes(item.exerciseId)) seen.push(item.exerciseId)
      if (seen.length >= 8) break
    }
    return seen
  }, [state.sessions])

  const list = useMemo(() => {
    let pool = library
    if (group !== 'All') pool = pool.filter((item) => item.primary === group)
    if (equipment !== 'All') pool = pool.filter((item) => item.equipment === equipment)
    return searchExercises(query, pool)
  }, [query, group, equipment])

  useEffect(() => setLimit(PAGE), [query, group, equipment])

  const recent = !query && group === 'All' && equipment === 'All' ? recentIds.map(exerciseById).filter(Boolean) : []
  const shown = list.slice(0, limit)
  const open = mode === 'pick' ? onPick : onOpen

  return (
    <div className="stack ex-browser">
      <div className="filters">
        <SearchField className="grow" value={query} onChange={setQuery} autoFocus={autoFocus} hotkey={mode === 'library'} count={query ? list.length : undefined} placeholder="Search 1,300+ exercises — bench, 深蹲, row…" label="Search exercises" />
        <select className="select pill-select" aria-label="Equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
          <option value="All">All equipment</option>
          {equipmentList.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
        </select>
      </div>
      <div className="chips scroll" role="group" aria-label="Muscle group">
        {['All', ...muscleGroups].map((item) => (
          <button key={item} type="button" aria-pressed={group === item} className={`chip ${group === item ? 'on' : ''}`} onClick={() => setGroup(item)}>{item}</button>
        ))}
      </div>
      {recent.length > 0 && (
        <section className="stack-sm">
          <h3 className="group-title">Recently used</h3>
          <div className={mode === 'pick' ? 'ex-list' : 'ex-grid'}>
            {recent.map((exercise) => <ExerciseCard key={`r-${exercise.id}`} exercise={exercise} mode={mode} onClick={() => open(exercise)} onInfo={onOpen} />)}
          </div>
          <h3 className="group-title">All exercises</h3>
        </section>
      )}
      {!query && <p className="muted small">{list.length.toLocaleString()} exercise{list.length === 1 ? '' : 's'}</p>}
      <div className={mode === 'pick' ? 'ex-list' : 'ex-grid'}>
        {shown.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} mode={mode} onClick={() => open(exercise)} onInfo={onOpen} />)}
      </div>
      {list.length === 0 && <p className="muted pad">No exercise matches. Try fewer words or another muscle group.</p>}
      {list.length > limit && (
        <button className="btn ghost wide" type="button" onClick={() => setLimit((value) => value + PAGE * 2)}>Show more ({(list.length - limit).toLocaleString()} left)</button>
      )}
      <p className="muted tiny">Exercise photos and animations © Gym visual — gymvisual.com</p>
    </div>
  )
}

function ExerciseCard({ exercise, mode, onClick, onInfo }) {
  if (mode === 'pick') {
    return (
      <div className="ex-row">
        <button className="ex-row-main" type="button" onClick={onClick}>
          <ExerciseImage exercise={exercise} className="thumb" />
          <span>
            <strong>{exercise.title}</strong>
            <small>{exercise.primary} · {exercise.equipment} · {exercise.target}</small>
          </span>
        </button>
        {onInfo && <button className="icon-btn" type="button" aria-label={`How to do ${exercise.title}`} onClick={() => onInfo(exercise)}><Icon name="info" /></button>}
        <button className="icon-btn bordered" type="button" aria-label={`Add ${exercise.title}`} onClick={onClick}><Icon name="plus" /></button>
      </div>
    )
  }
  return <LibraryCard exercise={exercise} onClick={onClick} />
}

// Hovering a card with a mouse plays the movement in place of the still photo.
function LibraryCard({ exercise, onClick }) {
  const [preview, setPreview] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button className="ex-card" type="button" onClick={onClick}
      onPointerEnter={(event) => { if (event.pointerType !== 'mouse') return; clearTimeout(timer.current); timer.current = setTimeout(() => setPreview(true), 260) }}
      onPointerLeave={() => { clearTimeout(timer.current); setPreview(false) }}>
      <span className="ex-card-media">{preview ? <ExerciseImage exercise={exercise} animated controls={false} /> : <ExerciseImage exercise={exercise} />}</span>
      <span className="ex-card-text">
        <strong>{exercise.title}</strong>
        <small>{exercise.equipment} · {exercise.target}</small>
      </span>
      <GroupTag group={exercise.primary} />
    </button>
  )
}

export function ExerciseDetail({ exercise, onClose, onAdd, addLabel = 'Add to workout' }) {
  const { state } = useStore()
  const [lang, setLang] = useState('en')
  const units = state.profile?.units || 'metric'
  const history = useMemo(() => exerciseHistory(state.sessions, exercise.id).slice(0, 5), [state.sessions, exercise.id])
  const record = useMemo(() => personalRecords(state.sessions).get(exercise.id), [state.sessions, exercise.id])
  const steps = lang === 'zh' && exercise.stepsZh.length ? exercise.stepsZh : exercise.cues

  return (
    <Modal
      title={exercise.title}
      subtitle={`${exercise.primary} · ${exercise.equipment}`}
      onClose={onClose}
      size="lg"
      footer={onAdd ? <div className="row end wide"><button className="btn ghost" type="button" onClick={onClose}>Close</button><button className="btn primary" type="button" onClick={onAdd}><Icon name="plus" size={16} />{addLabel}</button></div> : null}
    >
      <div className="ex-detail">
        <div className="ex-media"><ExerciseImage exercise={exercise} animated /></div>
        <div className="stack">
          <div className="tag-row">
            <GroupTag group={exercise.primary} />
            {exercise.muscles.map((muscle) => <span key={muscle} className="tag">{muscle}</span>)}
          </div>
          <div className="row spread">
            <h3>How to do it</h3>
            {exercise.stepsZh.length > 0 && (
              <div className="segmented small" role="radiogroup" aria-label="Language">
                <button type="button" role="radio" aria-checked={lang === 'en'} className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
                <button type="button" role="radio" aria-checked={lang === 'zh'} className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button>
              </div>
            )}
          </div>
          <ol className="steps">{steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          {(record?.weight || record?.reps) && (
            <div className="pr-box">
              <Icon name="trophy" size={18} />
              <div>
                <strong>Your best</strong>
                <p className="small">
                  {record.weight ? `${formatSet(record.weight, exercise, units)} on ${prettyDate(record.weight.date)}` : `${record.reps.reps} ${exercise.amountLabel} on ${prettyDate(record.reps.date)}`}
                  {record.e1rm && exercise.logging === 'strength' ? ` · est. 1-rep max ${formatWeight(record.e1rm.value, units)}` : ''}
                </p>
              </div>
            </div>
          )}
          {history.length > 0 && (
            <div className="stack-sm">
              <h3>Recent sessions</h3>
              <ul className="history">
                {history.map((item) => (
                  <li key={item.sessionId}><span className="muted small">{prettyDate(item.date)}</span><span>{item.sets.map((set) => formatSet(set, exercise, units)).join(', ')}</span></li>
                ))}
              </ul>
            </div>
          )}
          <p className="muted tiny">© Gym visual — gymvisual.com</p>
        </div>
      </div>
    </Modal>
  )
}

export function ExercisePickerModal({ title = 'Add an exercise', onClose, onPick }) {
  const [info, setInfo] = useState(null)
  return (
    <>
      <Modal title={title} onClose={onClose} size="lg" className="picker-modal">
        <ExerciseBrowser mode="pick" autoFocus onPick={onPick} onOpen={setInfo} />
      </Modal>
      {info && <ExerciseDetail exercise={info} onClose={() => setInfo(null)} onAdd={() => { const picked = info; setInfo(null); onPick(picked) }} addLabel="Add this exercise" />}
    </>
  )
}
