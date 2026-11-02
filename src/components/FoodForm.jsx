import { useMemo, useState } from 'react'
import { macroWarning } from '../lib/labelParse.js'
import { newId } from '../lib/nutrition.js'
import { Banner, Field, NumberInput, Segmented } from './ui.jsx'

const empty = {
  name: '',
  brand: '',
  mode: 'per100',
  servingLabel: '1 serving',
  servingGrams: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  sugar: '',
  sodium: '',
}

const trim = (value) => String(Math.round(Number(value) * 100) / 100)

export function foodToForm(food) {
  if (!food) return empty
  const serving = food.servings?.find((item) => item.id !== '100g')
  return {
    ...empty,
    name: food.name,
    brand: food.brand || '',
    mode: 'per100',
    servingLabel: serving?.label || '1 serving',
    servingGrams: serving ? trim(serving.grams) : '',
    kcal: trim(food.per100.kcal ?? 0),
    protein: trim(food.per100.protein ?? 0),
    carbs: trim(food.per100.carbs ?? 0),
    fat: trim(food.per100.fat ?? 0),
    fiber: trim(food.per100.fiber ?? 0),
    sugar: trim(food.per100.sugar ?? 0),
    sodium: trim(food.per100.sodium ?? 0),
  }
}

export function formFromParsed(parsed) {
  const per100 = Boolean(parsed.per100)
  const show = (value) => (value == null ? '' : String(value))
  return {
    ...empty,
    name: parsed.name || '',
    mode: per100 ? 'per100' : 'serving',
    servingGrams: !per100 && parsed.servingGrams ? String(parsed.servingGrams) : '',
    servingLabel: parsed.servingGrams && !per100 ? `1 serving (${parsed.servingGrams} g)` : '1 serving',
    kcal: show(parsed.kcal),
    protein: show(parsed.protein),
    carbs: show(parsed.carbs),
    fat: show(parsed.fat),
    fiber: show(parsed.fiber),
    sugar: show(parsed.sugar),
    sodium: show(parsed.sodium),
  }
}

function num(value) {
  if (String(value ?? '').trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const fields = [
  ['kcal', 'Calories', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
  ['fiber', 'Fiber', 'g'],
  ['sugar', 'Sugar', 'g'],
  ['sodium', 'Sodium', 'mg'],
]

export function FoodForm({ initial, base, submitLabel = 'Save food', onSave, onCancel }) {
  const [form, setForm] = useState(initial || empty)
  const [error, setError] = useState('')
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))
  const perServing = form.mode === 'serving'

  const warning = useMemo(() => {
    const values = ['kcal', 'protein', 'carbs', 'fat'].map((key) => num(form[key]))
    if (values.some((value) => value == null) || String(form.kcal).trim() === '') return null
    return macroWarning(...values)
  }, [form])

  function save(event) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return setError('Give the food a name.')
    if (String(form.kcal).trim() === '' || num(form.kcal) == null) return setError('Enter calories. Use 0 if the label really says zero.')
    if (fields.some(([key]) => num(form[key]) == null)) return setError('Every number has to be zero or more.')
    const portion = num(form.servingGrams)
    if (portion == null) return setError('Serving weight has to be a number of grams.')
    if (perServing && !(portion > 0)) return setError('Enter how many grams one serving weighs. It is printed next to the serving size.')
    if (portion > 5000) return setError('A serving over 5 kg looks like a typo.')
    const factor = perServing ? 100 / portion : 1
    const per100 = Object.fromEntries(fields.map(([key]) => [key, Math.round(num(form[key]) * factor * 100) / 100]))
    if (per100.protein + per100.carbs + per100.fat > 105) {
      return setError(perServing
        ? 'Protein, carbs and fat add up to more than the serving weighs. Check the serving grams.'
        : 'Protein, carbs and fat add up to more than 100 g per 100 g. Check for a missing decimal point.')
    }
    // The form edits the first portion; any other portions the food had are kept.
    const edited = base?.servings?.find((item) => item.id !== '100g')
    const servings = [{ id: '100g', label: '100 g', grams: 100 }]
    if (portion > 0) servings.push({ id: edited?.id || 'srv', label: form.servingLabel.trim() || '1 serving', grams: portion })
    for (const item of base?.servings || []) {
      if (item.id !== '100g' && item !== edited && !servings.some((other) => other.id === item.id)) servings.push(item)
    }
    setError('')
    onSave({
      ...(base || {}),
      id: base?.id || `custom-${newId()}`,
      custom: true,
      name,
      brand: form.brand.trim() || undefined,
      category: base?.category && base.category !== 'Custom' ? base.category : 'Custom',
      aliases: base?.aliases || [],
      approximate: false,
      per100,
      servings,
    })
  }

  return (
    <form className="stack" onSubmit={save} noValidate>
      <div className="grid-2">
        <Field label="Name"><input value={form.name} onChange={(event) => set('name')(event.target.value)} placeholder="Greek yogurt, plain" /></Field>
        <Field label="Brand (optional)"><input value={form.brand} onChange={(event) => set('brand')(event.target.value)} placeholder="Yili, Mengniu…" /></Field>
      </div>
      <div className="stack-sm">
        <span className="field-label">The numbers below are</span>
        <Segmented label="How the numbers are measured" value={form.mode} onChange={set('mode')} options={[['per100', 'Per 100 g / ml'], ['serving', 'Per serving']]} />
      </div>
      <div className="grid-2">
        <Field label={perServing ? 'Serving name' : 'Common portion name (optional)'}>
          <input value={form.servingLabel} onChange={(event) => set('servingLabel')(event.target.value)} placeholder="1 bar, 1 cup, 1 package" />
        </Field>
        <Field label={perServing ? 'Serving weight (g)' : 'Portion weight in g (optional)'}>
          <NumberInput value={form.servingGrams} onChange={set('servingGrams')} placeholder={perServing ? '40' : 'e.g. 250'} />
        </Field>
      </div>
      <div className="nutrient-grid">
        {fields.map(([key, label, unit]) => (
          <Field key={key} label={label} className={key === 'kcal' ? 'nutrient-kcal' : ''}>
            <div className="input-unit">
              <NumberInput value={form[key]} onChange={set(key)} placeholder="0" />
              <span>{unit}</span>
            </div>
          </Field>
        ))}
      </div>
      <p className="muted small">A blank nutrient is saved as 0. Leave it blank only when the label does not list it.</p>
      {warning && <Banner tone="warn">{warning}</Banner>}
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="row gap">
        <button className="btn primary" type="submit">{submitLabel}</button>
        {onCancel && <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
