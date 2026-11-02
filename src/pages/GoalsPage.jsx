import { useMemo, useState } from 'react'
import { adviceLines, planTargets } from '../lib/calc.js'
import { cmToFtIn, formatHeight, formatWeight, ftInToCm, kgToLb, lbToKg, round1, storeKg } from '../lib/units.js'
import { weekdayShort } from '../components/DateStepper.jsx'
import { useStore } from '../store.jsx'
import { Icon } from '../components/Icon.jsx'
import { Banner, ConfirmButton, NumberInput, PageHead, Segmented } from '../components/ui.jsx'

const activities = [
  ['sedentary', 'Sedentary', 'Little or no exercise'],
  ['light', 'Light', 'Exercise 1–3 times a week'],
  ['moderate', 'Moderate', 'Exercise 4–5 times a week'],
  ['active', 'Active', 'Daily exercise, or intense sessions 3–4 times a week'],
  ['very', 'Very active', 'Intense exercise 6–7 times a week'],
  ['extra', 'Extra active', 'Very intense daily exercise, or a physical job'],
]

const goals = [
  ['lose', 'Lose fat', 'A calorie deficit, protein at 2 g per kg'],
  ['gain', 'Gain muscle', 'A small surplus, protein at 1.8 g per kg'],
  ['recomp', 'Lose fat and gain muscle', 'High protein. Maintenance, or a mild cut if BMI is over 25'],
  ['maintain', 'Maintain', 'Eat around maintenance, protein at 1.6 g per kg'],
]

const paces = {
  lose: [[-0.25, 'Gentle'], [-0.5, 'Steady'], [-0.9, 'Faster']],
  gain: [[0.15, 'Lean'], [0.25, 'Steady'], [0.5, 'Faster']],
}

const dayOrder = [1, 2, 3, 4, 5, 6, 0]
const stepTitles = ['About you', 'Height and weight', 'Your goal', 'Your week']

export function GoalsPage({ onboarding = false }) {
  const { state, saveProfile, importState, erase, flash, setTheme, resetWorkouts } = useStore()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => formFromProfile(state.profile))
  const [error, setError] = useState('')
  const draft = useMemo(() => readProfile(form), [form])
  const targets = draft.profile ? planTargets(draft.profile) : null
  const lines = draft.profile && targets ? adviceLines(draft.profile, targets) : []

  function update(patch) {
    setError('')
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function changeGoal(goal) {
    const weeklyKg = goal === 'lose' ? -0.5 : goal === 'gain' ? 0.25 : 0
    update({ goal, weeklyKg })
  }

  function changeUnits(units) {
    if (units === form.units) return
    const metric = readMetric(form)
    if (!metric) {
      update({ units })
      return
    }
    if (units === 'imperial') {
      const height = cmToFtIn(metric.heightCm)
      update({
        units,
        feet: String(height.feet),
        inches: String(height.inches),
        pounds: String(round1(kgToLb(metric.weightKg))),
        target: metric.targetKg ? String(round1(kgToLb(metric.targetKg))) : form.target,
      })
    } else {
      update({
        units,
        height: String(round1(metric.heightCm)),
        weight: String(round1(metric.weightKg)),
        target: metric.targetKg ? String(round1(metric.targetKg)) : form.target,
      })
    }
  }

  function submit() {
    const next = readProfile(form)
    if (next.error) {
      setError(next.error)
      return
    }
    saveProfile(next.profile)
    setForm((prev) => ({ ...prev, baseKg: next.profile.weightKg }))
    if (!onboarding) flash('Goals saved')
  }

  const show = (index) => !onboarding || step === index

  const sections = (
    <div className="stack-lg">
      {show(0) && (
        <section className="form-section">
          {!onboarding && <h2 className="section-title">About you</h2>}
          <label className="field"><span className="field-label">Name (optional, for the greeting)</span><input value={form.name} onChange={(event) => update({ name: event.target.value })} /></label>
          <div className="stack-sm">
            <span className="field-label">Sex used by the calorie equation</span>
            <div className="choice-grid three">
              <Choice on={form.sex === 'female'} onClick={() => update({ sex: 'female' })} title="Female" />
              <Choice on={form.sex === 'male'} onClick={() => update({ sex: 'male' })} title="Male" />
              <Choice on={form.sex === 'average'} onClick={() => update({ sex: 'average' })} title="Average" detail="The midpoint, if neither fits" />
            </div>
          </div>
          <label className="field narrow-field"><span className="field-label">Age</span><NumberInput value={form.age} onChange={(value) => update({ age: value })} inputMode="numeric" /></label>
        </section>
      )}
      {show(1) && (
        <section className="form-section">
          {!onboarding && <h2 className="section-title">Body</h2>}
          <Segmented label="Units" value={form.units} onChange={changeUnits} options={[['metric', 'kg · cm'], ['imperial', 'lb · ft']]} />
          {form.units === 'metric' ? (
            <div className="grid-2">
              <label className="field"><span className="field-label">Height</span><div className="input-unit"><NumberInput value={form.height} onChange={(value) => update({ height: value })} /><span>cm</span></div></label>
              <label className="field"><span className="field-label">Weight</span><div className="input-unit"><NumberInput value={form.weight} onChange={(value) => update({ weight: value })} /><span>kg</span></div></label>
            </div>
          ) : (
            <div className="grid-3">
              <label className="field"><span className="field-label">Height</span><div className="input-unit"><NumberInput value={form.feet} onChange={(value) => update({ feet: value })} /><span>ft</span></div></label>
              <label className="field"><span className="field-label">&nbsp;</span><div className="input-unit"><NumberInput value={form.inches} onChange={(value) => update({ inches: value })} /><span>in</span></div></label>
              <label className="field"><span className="field-label">Weight</span><div className="input-unit"><NumberInput value={form.pounds} onChange={(value) => update({ pounds: value })} /><span>lb</span></div></label>
            </div>
          )}
        </section>
      )}
      {show(2) && (
        <>
          <section className="form-section">
            <h2 className="section-title">How active are you?</h2>
            <p className="muted small">This sets maintenance. Exercise means about 15–30 minutes with your heart rate up; intense means 45–120 minutes.</p>
            <div className="choice-grid two">
              {activities.map(([id, title, detail]) => <Choice key={id} on={form.activity === id} onClick={() => update({ activity: id })} title={title} detail={detail} />)}
            </div>
          </section>
          <section className="form-section">
            <h2 className="section-title">What do you want?</h2>
            <div className="choice-grid two">
              {goals.map(([id, title, detail]) => <Choice key={id} on={form.goal === id} onClick={() => changeGoal(id)} title={title} detail={detail} />)}
            </div>
            {paces[form.goal] && (
              <div className="stack-sm">
                <span className="field-label">Pace</span>
                <div className="choice-grid three">
                  {paces[form.goal].map(([value, title]) => (
                    <Choice key={value} on={form.weeklyKg === value} onClick={() => update({ weeklyKg: value })} title={title} detail={paceText(value, form.units)} />
                  ))}
                </div>
              </div>
            )}
            <label className="field narrow-field">
              <span className="field-label">Target weight (optional)</span>
              <div className="input-unit"><NumberInput value={form.target} onChange={(value) => update({ target: value })} /><span>{form.units === 'imperial' ? 'lb' : 'kg'}</span></div>
            </label>
          </section>
        </>
      )}
      {show(3) && (
        <section className="form-section">
          {!onboarding && <h2 className="section-title">Training days and water</h2>}
          <div className="stack-sm">
            <span className="field-label">Training days</span>
            <div className="chips">
              {dayOrder.map((day) => (
                <button key={day} type="button" aria-pressed={form.workoutDays.includes(day)} className={`chip ${form.workoutDays.includes(day) ? 'on' : ''}`} onClick={() => update({ workoutDays: form.workoutDays.includes(day) ? form.workoutDays.filter((item) => item !== day) : [...form.workoutDays, day] })}>{weekdayShort[day]}</button>
              ))}
            </div>
            <p className="muted small">The calendar marks a past training day with no workout as missed. Plans can set these for you.</p>
          </div>
          <label className="field narrow-field">
            <span className="field-label">Water goal (optional)</span>
            <div className="input-unit"><NumberInput value={form.waterGoal} inputMode="numeric" placeholder={targets ? String(targets.waterMl) : '35 ml per kg'} onChange={(value) => update({ waterGoal: value })} /><span>ml</span></div>
          </label>
        </section>
      )}
      {error && <Banner tone="bad">{error}</Banner>}
      {onboarding ? (
        <div className="row spread">
          <button className="btn ghost" type="button" onClick={() => { setError(''); setStep((value) => Math.max(0, value - 1)) }} disabled={step === 0}><Icon name="left" size={16} />Back</button>
          {step < 3 ? (
            <button className="btn primary" type="button" onClick={() => {
              const problem = validateStep(step, form)
              if (problem) setError(problem)
              else setStep((value) => value + 1)
            }}>Continue<Icon name="right" size={16} /></button>
          ) : <button className="btn primary" type="button" onClick={submit}>Start tracking<Icon name="check" size={16} /></button>}
        </div>
      ) : (
        <div className="row end"><button className="btn primary" type="button" onClick={submit}><Icon name="check" size={16} />Save goals</button></div>
      )}
    </div>
  )

  const preview = (
    <aside className="card stack numbers-card">
      <p className="eyebrow">Your numbers</p>
      {targets ? (
        <>
          <div className="big-number"><strong>{targets.calories.toLocaleString()}</strong><span>kcal a day</span></div>
          <div className="macro-chips">
            <span className="tone-protein"><i />Protein <b>{targets.proteinG} g</b></span>
            <span className="tone-carbs"><i />Carbs <b>{targets.carbsG} g</b></span>
            <span className="tone-fat"><i />Fat <b>{targets.fatG} g</b></span>
          </div>
          <dl className="facts">
            <div><dt>Maintenance</dt><dd>{targets.tdee.toLocaleString()} kcal</dd></div>
            <div><dt>BMR</dt><dd>{targets.bmr.toLocaleString()} kcal</dd></div>
            <div><dt>BMI</dt><dd>{targets.bmi.toFixed(1)} · {targets.bmiCategory}</dd></div>
            <div><dt>Healthy range</dt><dd>{formatWeight(targets.healthyMinKg, form.units)} – {formatWeight(targets.healthyMaxKg, form.units)}</dd></div>
            <div><dt>Water</dt><dd>{(targets.waterMl / 1000).toFixed(1)} L</dd></div>
            {targets.weeks > 0 && <div><dt>Target in</dt><dd>~{targets.weeks} weeks</dd></div>}
          </dl>
          <details className="advice">
            <summary>Why these numbers</summary>
            <div className="stack-sm">{lines.map((line) => <p key={line} className="small">{line}</p>)}</div>
          </details>
        </>
      ) : <p className="muted">Fill in sex, age, height, weight, activity and a goal to see your calorie target.</p>}
      <p className="muted tiny">Estimates from the Mifflin–St Jeor equation, not medical advice. Adjust from what your average weight does over two or three weeks.</p>
    </aside>
  )

  if (onboarding) {
    return (
      <div className="wizard">
        <div className="wizard-brand"><img className="logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" /><span>Daily Plate</span></div>
        <div className="wizard-steps" aria-label={`Step ${step + 1} of 4`}>
          {stepTitles.map((label, index) => <span key={label} className={index === step ? 'on' : index < step ? 'done' : ''}><i>{index < step ? <Icon name="check" size={12} /> : index + 1}</i>{label}</span>)}
        </div>
        <div className="wizard-body">
          <div className="card wizard-card">
            <h1>{stepTitles[step]}</h1>
            {step === 0 && <p className="muted">A few details, so the calorie and protein targets fit you. Everything stays on this device.</p>}
            {sections}
          </div>
          {step >= 2 && preview}
        </div>
      </div>
    )
  }

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Settings" title="Goals and settings">
        {state.profile && <p className="muted">Now {formatHeight(state.profile.heightCm, state.profile.units)} · {formatWeight(state.profile.weightKg, state.profile.units)}</p>}
      </PageHead>
      <div className="split">
        <div className="card">{sections}</div>
        <div className="stack sticky-col">{preview}</div>
      </div>
      <section className="card stack">
        <h2 className="section-title">Appearance</h2>
        <Segmented label="Theme" value={state.settings?.theme || 'system'} onChange={setTheme} options={[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']]} />
      </section>
      <Backup onImport={importState} onErase={erase} onResetWorkouts={() => { resetWorkouts(); flash('Workout history cleared') }} state={state} flash={flash} />
    </div>
  )
}

function Backup({ onImport, onErase, onResetWorkouts, state, flash }) {
  const desktop = Boolean(window.dailyPlate?.openBackups)
  return (
    <section className="card stack">
      <h2 className="section-title">Backup</h2>
      <p className="muted">Everything is stored on this device. {desktop ? 'The desktop app also saves a copy to its backups folder every time you change something (the last 14 days are kept).' : 'Export a file if you might clear the browser or switch devices.'}</p>
      <div className="row gap wrap">
        <button className="btn ghost" type="button" onClick={() => { download(state); flash('Backup file saved') }}><Icon name="download" size={16} />Export backup</button>
        <label className="btn ghost">
          <Icon name="upload" size={16} />Import backup
          <input className="sr-only" type="file" accept="application/json,.json" onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            try {
              onImport(JSON.parse(await file.text()))
              flash('Backup imported')
            } catch (error) {
              flash(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message || 'Could not read that file')
            }
          }} />
        </label>
        {desktop && <button className="btn ghost" type="button" onClick={() => window.dailyPlate.openBackups()}><Icon name="folder" size={16} />Open backups folder</button>}
        <ConfirmButton className="btn danger-ghost" icon="dumbbell" confirmText="Delete every logged workout?" onConfirm={onResetWorkouts}>Reset workout history</ConfirmButton>
        <ConfirmButton className="btn danger-ghost" icon="trash" confirmText="Erase everything on this device?" onConfirm={onErase}>Erase all data</ConfirmButton>
      </div>
    </section>
  )
}

function download(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const day = new Date()
  link.href = url
  link.download = `daily-plate-backup-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Choice({ on, onClick, title, detail }) {
  return (
    <button type="button" className={`choice ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
      {on && <i className="choice-check"><Icon name="check" size={13} /></i>}
    </button>
  )
}

function formFromProfile(profile) {
  const units = profile?.units || 'metric'
  const base = {
    name: profile?.name || '',
    sex: profile?.sex || '',
    age: profile?.age ? String(profile.age) : '',
    units,
    height: '',
    weight: '',
    feet: '',
    inches: '',
    pounds: '',
    activity: profile?.activity || '',
    goal: profile?.goal || '',
    weeklyKg: profile?.weeklyKg ?? (profile?.goal === 'lose' ? -0.5 : profile?.goal === 'gain' ? 0.25 : 0),
    target: '',
    workoutDays: profile?.workoutDays || [1, 3, 5],
    waterGoal: profile?.waterGoalMl ? String(profile.waterGoalMl) : '',
    baseKg: Number.isFinite(profile?.weightKg) ? profile.weightKg : null,
  }
  if (!profile) return base
  if (units === 'imperial') {
    const height = cmToFtIn(profile.heightCm)
    base.feet = String(height.feet)
    base.inches = String(height.inches)
    base.pounds = String(round1(kgToLb(profile.weightKg)))
    if (profile.targetWeightKg) base.target = String(round1(kgToLb(profile.targetWeightKg)))
  } else {
    base.height = String(profile.heightCm)
    base.weight = String(round1(profile.weightKg))
    if (profile.targetWeightKg) base.target = String(round1(profile.targetWeightKg))
  }
  return base
}

function blankNumber(value) {
  if (String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// An untouched weight field keeps the saved weight exactly, so switching units
// or saving other settings never nudges the weight by a rounding step.
function keptKg(form, typed, shown) {
  return form.baseKg != null && String(typed).trim() === shown ? form.baseKg : null
}

function readMetric(form) {
  if (form.units === 'imperial') {
    const feet = blankNumber(form.feet)
    const inches = blankNumber(form.inches)
    const pounds = blankNumber(form.pounds)
    if (feet == null || inches == null || pounds == null) return null
    const target = blankNumber(form.target)
    const weightKg = keptKg(form, form.pounds, form.baseKg != null ? String(round1(kgToLb(form.baseKg))) : '') ?? lbToKg(pounds)
    return { heightCm: ftInToCm(feet, inches), weightKg, targetKg: target == null ? null : lbToKg(target) }
  }
  const heightCm = blankNumber(form.height)
  const typed = blankNumber(form.weight)
  if (heightCm == null || typed == null) return null
  const target = blankNumber(form.target)
  const weightKg = keptKg(form, form.weight, form.baseKg != null ? String(round1(form.baseKg)) : '') ?? typed
  return { heightCm, weightKg, targetKg: target }
}

function readProfile(form) {
  const age = blankNumber(form.age)
  if (!form.sex) return { error: 'Choose the sex the calorie equation should use.' }
  if (age == null || age < 16 || age > 90 || !Number.isInteger(age)) return { error: 'Enter an age from 16 to 90.' }
  const metric = readMetric(form)
  if (!metric) return { error: 'Enter your height and weight.' }
  if (metric.heightCm < 120 || metric.heightCm > 230) return { error: 'Height needs to be between 120 and 230 cm.' }
  if (metric.weightKg < 30 || metric.weightKg > 250) return { error: 'Weight needs to be between 30 and 250 kg.' }
  if (!form.activity) return { error: 'Choose the activity description that fits most weeks.' }
  if (!form.goal) return { error: 'Choose a goal.' }
  if ((form.goal === 'lose' || form.goal === 'gain') && !Number.isFinite(form.weeklyKg)) return { error: 'Choose a pace.' }
  if (metric.targetKg != null && (metric.targetKg < 30 || metric.targetKg > 250)) return { error: 'Target weight needs to be between 30 and 250 kg.' }
  const water = blankNumber(form.waterGoal)
  if (form.waterGoal.trim() && (water == null || water < 500 || water > 8000)) return { error: 'Water goal should be between 500 and 8000 ml, or left blank.' }
  return {
    profile: {
      name: form.name.trim(),
      sex: form.sex,
      age,
      heightCm: round1(metric.heightCm),
      weightKg: storeKg(metric.weightKg),
      units: form.units,
      activity: form.activity,
      goal: form.goal,
      weeklyKg: form.goal === 'lose' || form.goal === 'gain' ? form.weeklyKg : 0,
      targetWeightKg: metric.targetKg == null ? null : storeKg(metric.targetKg),
      workoutDays: [...form.workoutDays].sort((a, b) => a - b),
      waterGoalMl: water || undefined,
    },
  }
}

function validateStep(step, form) {
  if (step === 0) {
    if (!form.sex) return 'Choose the sex the calorie equation should use.'
    const age = blankNumber(form.age)
    if (age == null || age < 16 || age > 90 || !Number.isInteger(age)) return 'Enter an age from 16 to 90.'
  }
  if (step === 1) {
    const metric = readMetric({ ...form, target: '' })
    if (!metric) return 'Enter your height and weight.'
    if (metric.heightCm < 120 || metric.heightCm > 230) return 'Height needs to be between 120 and 230 cm.'
    if (metric.weightKg < 30 || metric.weightKg > 250) return 'Weight needs to be between 30 and 250 kg.'
  }
  if (step === 2) {
    if (!form.activity) return 'Choose the activity description that fits most weeks.'
    if (!form.goal) return 'Choose a goal.'
    if ((form.goal === 'lose' || form.goal === 'gain') && !Number.isFinite(form.weeklyKg)) return 'Choose a pace.'
  }
  return ''
}

function paceText(kgPerWeek, units) {
  const amount = units === 'imperial' ? `${round1(Math.abs(kgToLb(kgPerWeek)))} lb` : `${Math.abs(kgPerWeek)} kg`
  return `${amount} a week`
}
