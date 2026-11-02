import { useState } from 'react'
import { useStore, targetsForDate } from '../store.jsx'
import { useRoute } from '../router.jsx'
import { addDays, mealForNow, prettyDate } from '../lib/dates.js'
import { meals, newId, nutritionFor, roundKcal, roundMacro, sumNutrition } from '../lib/nutrition.js'
import { formatPortion } from '../lib/measure.js'
import { FoodPicker, QuickAdd } from '../components/FoodPicker.jsx'
import { FoodForm } from '../components/FoodForm.jsx'
import { Icon } from '../components/Icon.jsx'
import { MacroBar } from '../components/Ring.jsx'
import { Modal, PageHead } from '../components/ui.jsx'

const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium']

export function DiaryPage() {
  const { state, targets, viewDate } = useStore()
  const items = state.diary[viewDate]?.items || []
  const totals = sumNutrition(items)
  const goal = targetsForDate(state, viewDate, targets)
  const remaining = (goal?.calories || 0) - totals.kcal
  return (
    <div className="page stack-lg">
      <PageHead eyebrow={prettyDate(viewDate, { weekday: 'long', month: 'long', day: 'numeric' })} title="Food diary" />
      <section className="card day-summary">
        <div className="day-kcal">
          <span className="muted small">Eaten</span>
          <strong>{roundKcal(totals.kcal).toLocaleString()}</strong>
          <span className="muted small">of {goal?.calories?.toLocaleString() || '—'} kcal</span>
        </div>
        <div className={`day-left ${remaining < 0 ? 'over' : ''}`}>
          <span className="muted small">{remaining >= 0 ? 'Left' : 'Over'}</span>
          <strong>{roundKcal(Math.abs(remaining)).toLocaleString()}</strong>
          <span className="muted small">kcal</span>
        </div>
        <div className="day-macros">
          <MacroBar label="Protein" value={totals.protein} goal={goal?.proteinG || 0} tone="protein" />
          <MacroBar label="Carbs" value={totals.carbs} goal={goal?.carbsG || 0} tone="carbs" />
          <MacroBar label="Fat" value={totals.fat} goal={goal?.fatG || 0} tone="fat" />
        </div>
        <p className="muted small day-extra">Fiber {roundKcal(totals.fiber)} / {goal?.fiberG || '—'} g · Sugar {roundKcal(totals.sugar)} g · Sodium {roundKcal(totals.sodium).toLocaleString()} mg</p>
      </section>
      <DiaryMeals date={viewDate} />
    </div>
  )
}

export function DiaryMeals({ date, compact = false }) {
  const { state, saveCustomFood, addFoodItem, replaceFoodItem, removeFoodItem, moveFoodItem, copyDiary, flash } = useStore()
  const { go } = useRoute()
  const [picker, setPicker] = useState(null)
  const [quick, setQuick] = useState(null)
  const [creating, setCreating] = useState(null)
  const items = state.diary[date]?.items || []
  const yesterday = addDays(date, -1)
  const yesterdayItems = state.diary[yesterday]?.items || []

  function savePicked(result) {
    const editing = picker.editing
    if (editing && result.rescaleGrams) {
      const factor = editing.grams > 0 ? result.rescaleGrams / editing.grams : 0
      const next = { ...editing, grams: result.rescaleGrams, quantity: result.rescaleGrams, servingLabel: 'g', meal: result.meal }
      for (const key of nutrientKeys) next[key] = (editing[key] || 0) * factor
      replaceFoodItem(date, next)
    } else if (result.food) {
      const next = {
        id: editing?.id || newId(),
        foodId: result.food.id,
        name: result.food.name,
        meal: result.meal,
        grams: result.grams,
        quantity: result.quantity,
        servingLabel: result.servingLabel,
        ...nutritionFor(result.food.per100, result.grams),
      }
      if (editing) replaceFoodItem(date, next)
      else {
        addFoodItem(date, next)
        flash(`Added ${result.food.name} · ${roundKcal(next.kcal)} kcal`)
      }
    }
    setPicker(null)
  }

  function edit(item) {
    if (item.quick) setQuick({ meal: item.meal, editing: item })
    else setPicker({ meal: item.meal, editing: item })
  }

  function copyFrom(meal) {
    const count = copyDiary(yesterday, date, meal)
    const what = meal ? meals.find((item) => item.id === meal)?.label.toLowerCase() : 'the day before'
    flash(count ? `Copied ${count} item${count === 1 ? '' : 's'} from ${meal ? `yesterday's ${what}` : what}` : `Nothing was logged ${meal ? `for ${what} ` : ''}the day before`)
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <button className="btn primary" type="button" onClick={() => setPicker({ meal: mealForNow() })}><Icon name="plus" size={17} />Add food</button>
        <button className="btn ghost" type="button" onClick={() => setQuick({ meal: mealForNow() })}><Icon name="bolt" size={16} />Quick add</button>
        <button className="btn ghost" type="button" onClick={() => go('scan')}><Icon name="scan" size={16} />Scan label</button>
        {!compact && <button className="btn ghost" type="button" onClick={() => copyFrom(null)} disabled={!yesterdayItems.length} title={yesterdayItems.length ? '' : 'Nothing logged the day before'}><Icon name="copy" size={16} />Copy previous day</button>}
      </div>
      <div className={compact ? 'meal-grid compact' : 'meal-grid'}>
        {meals.map((meal) => {
          const mealItems = items.filter((item) => item.meal === meal.id)
          const sum = sumNutrition(mealItems)
          const hasYesterday = yesterdayItems.some((item) => item.meal === meal.id)
          return (
            <article key={meal.id} className="card meal-card">
              <header className="meal-head">
                <div>
                  <h3>{meal.label}</h3>
                  <p className="muted small">{mealItems.length ? `P ${roundMacro(sum.protein)} · C ${roundMacro(sum.carbs)} · F ${roundMacro(sum.fat)}` : 'Nothing yet'}</p>
                </div>
                <div className="meal-head-side">
                  <strong className="kcal-pill">{roundKcal(sum.kcal)} kcal</strong>
                  <button className="icon-btn bordered" type="button" aria-label={`Add to ${meal.label}`} onClick={() => setPicker({ meal: meal.id })}><Icon name="plus" /></button>
                </div>
              </header>
              {mealItems.length > 0 && (
                <ul className="food-list">
                  {mealItems.map((item) => (
                    <li key={item.id} className="food-row">
                      <button className="food-main" type="button" onClick={() => edit(item)}>
                        <strong>{item.name}</strong>
                        <small>{formatPortion(item)} · P {roundMacro(item.protein)} C {roundMacro(item.carbs)} F {roundMacro(item.fat)}</small>
                      </button>
                      <span className="food-kcal">{roundKcal(item.kcal)}</span>
                      <div className="food-actions">
                        <select className="mini-select" aria-label={`Move ${item.name} to another meal`} value={item.meal} onChange={(event) => moveFoodItem(date, item.id, event.target.value)}>
                          {meals.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                        <button className="icon-btn" type="button" aria-label={`Edit ${item.name}`} onClick={() => edit(item)}><Icon name="edit" size={16} /></button>
                        <button className="icon-btn danger" type="button" aria-label={`Remove ${item.name}`} onClick={() => removeFoodItem(date, item.id)}><Icon name="trash" size={16} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!compact && !mealItems.length && hasYesterday && (
                <button className="link-btn" type="button" onClick={() => copyFrom(meal.id)}><Icon name="copy" size={14} />Copy yesterday’s {meal.label.toLowerCase()}</button>
              )}
            </article>
          )
        })}
      </div>
      {picker && (
        <FoodPicker
          meal={picker.meal}
          editing={picker.editing || null}
          initialFood={picker.initialFood || null}
          onClose={() => setPicker(null)}
          onSave={savePicked}
          onQuickAdd={(meal) => { setPicker(null); setQuick({ meal }) }}
          onCreate={() => { const meal = picker.meal; setPicker(null); setCreating({ meal }) }}
        />
      )}
      {quick && (
        <QuickAdd
          meal={quick.meal}
          editing={quick.editing || null}
          onClose={() => setQuick(null)}
          onSave={(item) => {
            if (quick.editing) replaceFoodItem(date, item)
            else {
              addFoodItem(date, item)
              flash(`Added ${item.name} · ${roundKcal(item.kcal)} kcal`)
            }
            setQuick(null)
          }}
        />
      )}
      {creating && (
        <Modal title="Create a food" subtitle="It is saved to My foods, then you pick the amount." onClose={() => setCreating(null)} size="md">
          <FoodForm
            submitLabel="Save and continue"
            onCancel={() => setCreating(null)}
            onSave={(food) => {
              saveCustomFood(food)
              const meal = creating.meal
              setCreating(null)
              setPicker({ meal, initialFood: food })
              flash(`${food.name} saved to My foods`)
            }}
          />
        </Modal>
      )}
    </section>
  )
}
