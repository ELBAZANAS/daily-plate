import { useEffect, useMemo, useState } from 'react'
import { foods as builtInFoods, popularFoodIds } from '../data/foods.js'
import { cjkAlias, meals, newId, nutritionFor, roundKcal, roundMacro } from '../lib/nutrition.js'
import { searchFoods } from '../lib/search.js'
import { amountFromGrams, amountUnits, formatAmount, gramsFrom, isVolumeUnit, sliderFor } from '../lib/measure.js'
import { useStore } from '../store.jsx'
import { Icon } from './Icon.jsx'
import { Banner, Modal, NumberInput, SearchField, Segmented } from './ui.jsx'

const mealOptions = meals.map((meal) => [meal.id, meal.label])

export function FoodPicker({ meal, editing, initialFood, onClose, onSave, onQuickAdd, onCreate }) {
  const { allFoods, state, toggleFavorite, saveCustomFood, flash } = useStore()
  const [query, setQuery] = useState('')
  const [food, setFood] = useState(null)
  const [servingId, setServingId] = useState('100g')
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')
  const [pickedMeal, setPickedMeal] = useState(meal || 'breakfast')
  const [confirmLarge, setConfirmLarge] = useState(false)

  useEffect(() => {
    if (!editing) return
    const found = allFoods.find((item) => item.id === editing.foodId) || null
    setFood(found)
    setPickedMeal(editing.meal)
    if (found) {
      const match = found.servings.find((serving) => serving.label === editing.servingLabel)
      setServingId(match?.id || found.servings[0].id)
      if (amountUnits.some(([id]) => id === editing.servingLabel)) {
        setUnit(editing.servingLabel)
        setQuantity(formatAmount(editing.quantity || editing.grams || 100))
      } else {
        setUnit('g')
        setQuantity(formatAmount(editing.grams || 100))
      }
    } else {
      setQuantity(formatAmount(editing.grams || 100))
      setUnit('g')
    }
    setConfirmLarge(false)
    // Only reset when a different diary entry is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  useEffect(() => {
    if (initialFood && !editing) choose(initialFood)
    // Runs once, for a food that was just created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const results = useMemo(() => (query.trim() ? searchFoods(query, allFoods) : []), [query, allFoods])
  const byId = useMemo(() => new Map(allFoods.map((item) => [item.id, item])), [allFoods])
  const favorites = state.favorites.map((id) => byId.get(id)).filter(Boolean)
  const recent = state.recentFoodIds.map((id) => byId.get(id)).filter(Boolean).filter((item) => !state.favorites.includes(item.id))
  const mine = state.customFoods.filter((item) => !state.favorites.includes(item.id) && !state.recentFoodIds.includes(item.id)).slice(0, 8)
  const popular = popularFoodIds.map((id) => builtInFoods.find((item) => item.id === id)).filter(Boolean)

  const serving = food?.servings.find((item) => item.id === servingId) || food?.servings[0]
  const qty = Number(quantity)
  const grams = food && serving
    ? gramsFrom(food, qty, unit, serving.grams)
    : editing && !food ? gramsFrom(null, qty, 'g') : 0
  const slider = sliderFor(unit)
  const sliderMax = Math.max(slider.max, Number.isFinite(qty) ? qty : 0)
  const preview = food ? nutritionFor(food.per100, grams) : null
  const orphanKcal = editing && !food && editing.grams > 0 ? editing.kcal * (grams / editing.grams) : 0
  const showDetail = Boolean(food) || Boolean(editing && !food)

  function choose(next) {
    const portion = next.servings[1] || next.servings[0]
    setFood(next)
    setServingId(portion.id)
    setUnit('g')
    setQuantity(formatAmount(portion.grams))
    setConfirmLarge(false)
  }

  function changeUnit(nextUnit) {
    const nextAmount = amountFromGrams(food, grams, nextUnit, serving?.grams || 100)
    setUnit(nextUnit)
    setQuantity(formatAmount(nextAmount))
    setConfirmLarge(false)
  }

  function applyPortion(id) {
    const next = food.servings.find((item) => item.id === id)
    setServingId(id)
    if (!next) return
    setUnit('g')
    setQuantity(formatAmount(next.grams))
    setConfirmLarge(false)
  }

  function step(direction) {
    const current = Number(quantity) || 0
    setQuantity(formatAmount(Math.max(0, current + direction * (unit === 'g' || unit === 'ml' ? 10 : slider.step))))
    setConfirmLarge(false)
  }

  function keepFood() {
    if (!food || food.custom) return
    if (state.customFoods.some((item) => item.sourceId === food.id)) {
      flash('Already in My foods')
      return
    }
    saveCustomFood({ ...food, id: newId(), sourceId: food.id, custom: true })
    flash('Saved to My foods')
  }

  function save() {
    if (!(grams > 0)) return
    if (grams > 2000 && !confirmLarge) {
      setConfirmLarge(true)
      return
    }
    if (food) {
      onSave({ food, grams, quantity: qty, servingLabel: unit, meal: pickedMeal })
    } else if (editing) {
      onSave({ rescaleGrams: grams, meal: pickedMeal })
    }
  }

  const title = food ? food.name : editing ? 'Edit entry' : 'Add food'

  return (
    <Modal
      title={title}
      subtitle={food ? [food.brand, cjkAlias(food), food.category, food.approximate ? 'approximate dish' : ''].filter(Boolean).join(' · ') : editing ? null : `To ${meals.find((item) => item.id === pickedMeal)?.label.toLowerCase()}`}
      onClose={onClose}
      size="md"
      className="food-picker"
      footer={showDetail ? (
        <div className="row spread wide">
          {!editing ? <button className="btn ghost" type="button" onClick={() => { setFood(null); setConfirmLarge(false) }}><Icon name="left" size={16} />Back</button> : <span />}
          <button className="btn primary" type="button" onClick={save} disabled={!(grams > 0)}>
            {confirmLarge ? 'Yes, log this amount' : editing ? 'Save changes' : 'Add to diary'}
          </button>
        </div>
      ) : null}
    >
      {showDetail ? (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); save() }}>
          {food && (
            <div className="row gap wrap">
              <button className={`btn small ${state.favorites.includes(food.id) ? 'soft' : 'ghost'}`} type="button" onClick={() => toggleFavorite(food.id)}>
                <Icon name="star" size={16} filled={state.favorites.includes(food.id)} />
                {state.favorites.includes(food.id) ? 'Starred' : 'Star'}
              </button>
              {!food.custom && <button className="btn ghost small" type="button" onClick={keepFood}><Icon name="plus" size={16} />Save to My foods</button>}
            </div>
          )}
          {!food && editing && <Banner>This food is no longer in your list. You can still change the amount — the nutrition scales with the grams.</Banner>}
          {food && food.servings.length > 1 && (
            <div className="stack-sm">
              <span className="field-label">Portions</span>
              <div className="chips">
                {food.servings.map((item) => (
                  <button key={item.id} type="button" className={`chip ${servingId === item.id && unit === 'g' && Math.abs(grams - item.grams) < 0.01 ? 'on' : ''}`} onClick={() => applyPortion(item.id)}>
                    {item.label}{item.label.replace(/\s/g, '') !== `${item.grams}g` ? ` · ${formatAmount(item.grams)} g` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="amount-box">
            <div className="amount-edit">
              <button type="button" className="icon-btn bordered" onClick={() => step(-1)} aria-label="Less"><Icon name="minus" /></button>
              <NumberInput data-autofocus aria-label="Amount" value={quantity} onChange={(value) => { setQuantity(value); setConfirmLarge(false) }} />
              <button type="button" className="icon-btn bordered" onClick={() => step(1)} aria-label="More"><Icon name="plus" /></button>
              {food ? (
                <select aria-label="Unit" value={unit} onChange={(event) => changeUnit(event.target.value)}>
                  {amountUnits.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              ) : <span className="unit-label">grams</span>}
            </div>
            <input
              className="slider"
              type="range"
              min={slider.min}
              max={sliderMax}
              step={slider.step}
              aria-label={`Amount in ${unit}`}
              value={Number.isFinite(qty) ? Math.min(sliderMax, Math.max(slider.min, qty)) : 0}
              onChange={(event) => { setQuantity(event.target.value); setConfirmLarge(false) }}
            />
            {food && unit !== 'g' && (
              <p className="muted small">= {roundMacro(grams)} g{isVolumeUnit(unit) ? (food.density ? ` · ${food.density} g per ml` : ' · 1 ml counted as 1 g') : ''}</p>
            )}
          </div>
          <div className="stack-sm">
            <span className="field-label">Meal</span>
            <Segmented label="Meal" value={pickedMeal} onChange={setPickedMeal} options={mealOptions} />
          </div>
          <div className="nutri-preview">
            <div className="nutri-kcal">
              <strong>{roundKcal(preview ? preview.kcal : orphanKcal).toLocaleString()}</strong>
              <span>kcal</span>
            </div>
            {preview && (
              <div className="nutri-macros">
                <span className="tone-protein"><i />Protein <b>{roundMacro(preview.protein)} g</b></span>
                <span className="tone-carbs"><i />Carbs <b>{roundMacro(preview.carbs)} g</b></span>
                <span className="tone-fat"><i />Fat <b>{roundMacro(preview.fat)} g</b></span>
                <span className="tone-fiber"><i />Fiber <b>{roundMacro(preview.fiber)} g</b></span>
              </div>
            )}
          </div>
          {confirmLarge && <Banner tone="warn">That is {Math.round(grams).toLocaleString()} g. Press the button again if that is right.</Banner>}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      ) : (
        <div className="stack">
          <SearchField value={query} onChange={setQuery} modalFocus count={query.trim() ? results.length : undefined} onEnter={() => { if (results[0]) choose(results[0]) }} placeholder="Search foods — chicken, 米饭, oats…" label="Search foods" />
          <div className="row gap wrap">
            {onQuickAdd && <button className="btn ghost small" type="button" onClick={() => onQuickAdd(pickedMeal)}><Icon name="bolt" size={16} />Quick add calories</button>}
            {onCreate && <button className="btn ghost small" type="button" onClick={onCreate}><Icon name="plus" size={16} />Create a food</button>}
          </div>
          {query.trim() ? (
            <div className="result-list">
              {results.length === 0 && <p className="muted pad">Nothing matches “{query.trim()}”. Create it, scan its label, or use quick add.</p>}
              {results.map((item) => <FoodResult key={item.id} food={item} starred={state.favorites.includes(item.id)} onChoose={choose} />)}
            </div>
          ) : (
            <div className="stack">
              {favorites.length > 0 && <FoodGroup title="Starred" items={favorites} favorites={state.favorites} onChoose={choose} />}
              {recent.length > 0 && <FoodGroup title="Recent" items={recent} favorites={state.favorites} onChoose={choose} />}
              {mine.length > 0 && <FoodGroup title="My foods" items={mine} favorites={state.favorites} onChoose={choose} />}
              <FoodGroup title="Common foods" items={popular} favorites={state.favorites} onChoose={choose} />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function FoodGroup({ title, items, favorites, onChoose }) {
  return (
    <section className="stack-sm">
      <h3 className="group-title">{title}</h3>
      <div className="result-list">
        {items.map((item) => <FoodResult key={item.id} food={item} starred={favorites.includes(item.id)} onChoose={onChoose} />)}
      </div>
    </section>
  )
}

function FoodResult({ food, starred, onChoose }) {
  const serving = food.servings[1] || food.servings[0]
  const kcal = roundKcal(nutritionFor(food.per100, serving.grams).kcal)
  const alias = cjkAlias(food)
  return (
    <button className="result" type="button" onClick={() => onChoose(food)}>
      <span className="result-main">
        <strong>{food.name}{starred && <Icon name="star" size={13} filled className="star-mark" />}</strong>
        <small>{[food.brand, alias, food.custom ? 'Yours' : food.category].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="result-side"><b>{kcal}</b> kcal<small>{serving.label}</small></span>
    </button>
  )
}

export function QuickAdd({ meal, editing, onClose, onSave }) {
  const [name, setName] = useState(editing?.name || '')
  const [pickedMeal, setPickedMeal] = useState(editing?.meal || meal || 'snack')
  const [values, setValues] = useState({
    kcal: editing ? String(Math.round(editing.kcal)) : '',
    protein: editing?.protein ? String(roundMacro(editing.protein)) : '',
    carbs: editing?.carbs ? String(roundMacro(editing.carbs)) : '',
    fat: editing?.fat ? String(roundMacro(editing.fat)) : '',
  })
  const [error, setError] = useState('')
  const set = (key) => (value) => setValues((prev) => ({ ...prev, [key]: value }))

  function save(event) {
    event?.preventDefault()
    const read = (value) => (String(value).trim() === '' ? 0 : Number(value))
    const kcal = read(values.kcal)
    const macros = ['protein', 'carbs', 'fat'].map((key) => read(values[key]))
    if (!(kcal > 0) || kcal > 10000) return setError('Enter the calories, between 1 and 10,000.')
    if (macros.some((value) => !Number.isFinite(value) || value < 0 || value > 1000)) return setError('Macros have to be numbers from 0 to 1,000 g.')
    onSave({
      id: editing?.id || newId(),
      foodId: null,
      quick: true,
      name: name.trim() || 'Quick add',
      meal: pickedMeal,
      grams: 0,
      quantity: 1,
      servingLabel: 'serving',
      kcal,
      protein: macros[0],
      carbs: macros[1],
      fat: macros[2],
      fiber: editing?.fiber || 0,
      sugar: editing?.sugar || 0,
      sodium: editing?.sodium || 0,
    })
  }

  return (
    <Modal title={editing ? 'Edit quick add' : 'Quick add'} subtitle="For a meal out or anything you only know the calories of." onClose={onClose} size="sm"
      footer={<div className="row end wide"><button className="btn ghost" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" onClick={save}>{editing ? 'Save' : 'Add'}</button></div>}>
      <form className="stack" onSubmit={save}>
        <label className="field"><span className="field-label">What was it? (optional)</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Lunch at the canteen" /></label>
        <label className="field"><span className="field-label">Calories</span><div className="input-unit big"><NumberInput data-autofocus value={values.kcal} onChange={set('kcal')} placeholder="0" /><span>kcal</span></div></label>
        <div className="grid-3 keep">
          {[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([key, label]) => (
            <label key={key} className="field"><span className="field-label">{label}</span><div className="input-unit"><NumberInput value={values[key]} onChange={set(key)} placeholder="0" /><span>g</span></div></label>
          ))}
        </div>
        <div className="stack-sm"><span className="field-label">Meal</span><Segmented label="Meal" value={pickedMeal} onChange={setPickedMeal} options={mealOptions} /></div>
        {error && <Banner tone="bad">{error}</Banner>}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
