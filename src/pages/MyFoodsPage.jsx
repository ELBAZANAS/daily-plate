import { useMemo, useState } from 'react'
import { foods as builtInFoods } from '../data/foods.js'
import { useStore } from '../store.jsx'
import { useRoute } from '../router.jsx'
import { FoodForm, foodToForm } from '../components/FoodForm.jsx'
import { Icon } from '../components/Icon.jsx'
import { ConfirmButton, Empty, Modal, PageHead, SearchField } from '../components/ui.jsx'
import { cjkAlias, newId, roundKcal, roundMacro } from '../lib/nutrition.js'
import { searchFoods } from '../lib/search.js'

export function MyFoodsPage() {
  const { state, saveCustomFood, deleteCustomFood, toggleFavorite, flash } = useStore()
  const { go } = useRoute()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const results = useMemo(() => (query.trim() ? searchFoods(query, builtInFoods).slice(0, 10) : []), [query])
  const mine = useMemo(() => (filter.trim() ? searchFoods(filter, state.customFoods) : state.customFoods), [filter, state.customFoods])

  function listFood(food) {
    if (state.customFoods.some((item) => item.sourceId === food.id)) return
    saveCustomFood({ ...food, id: newId(), sourceId: food.id, custom: true })
    flash(`${food.name} added to My foods`)
  }

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Food" title="My foods"
        actions={(
          <>
            <button className="btn ghost" type="button" onClick={() => go('scan')}><Icon name="scan" size={16} />Scan a label</button>
            <button className="btn primary" type="button" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Create a food</button>
          </>
        )}>
        <p className="muted">Foods you made or saved. They show up first in search. Old diary entries keep the numbers from the day you logged them, so editing a food never changes the past.</p>
      </PageHead>

      <div className="split">
        <section className="stack">
          <div className="section-head">
            <h2>{state.customFoods.length} saved food{state.customFoods.length === 1 ? '' : 's'}</h2>
          </div>
          {state.customFoods.length > 5 && (
            <SearchField value={filter} onChange={setFilter} count={filter ? mine.length : undefined} placeholder="Filter my foods" hotkey />
          )}
          {state.customFoods.length === 0 && (
            <div className="card"><Empty icon="apple" title="No foods saved yet" action={<button className="btn primary small" type="button" onClick={() => go('scan')}><Icon name="scan" size={15} />Scan your first label</button>}>Scan a package label, create a food by hand, or copy one from the built-in list.</Empty></div>
          )}
          <div className="food-cards">
            {mine.map((food) => {
              const serving = food.servings?.find((item) => item.id !== '100g')
              return (
                <article key={food.id} className="card food-card">
                  <div className="food-card-main">
                    <div>
                      <h3>{food.name}</h3>
                      <p className="muted small">{[food.brand, cjkAlias(food), serving ? `${serving.label} = ${roundMacro(serving.grams)} g` : null].filter(Boolean).join(' · ') || 'Per 100 g'}</p>
                    </div>
                    <button className={`icon-btn ${state.favorites.includes(food.id) ? 'on star' : ''}`} type="button" aria-label={state.favorites.includes(food.id) ? 'Unstar' : 'Star'} aria-pressed={state.favorites.includes(food.id)} onClick={() => toggleFavorite(food.id)}><Icon name="star" filled={state.favorites.includes(food.id)} /></button>
                  </div>
                  <div className="per100">
                    <span><b>{roundKcal(food.per100.kcal)}</b> kcal</span>
                    <span className="tone-protein"><i />P <b>{roundMacro(food.per100.protein)}</b></span>
                    <span className="tone-carbs"><i />C <b>{roundMacro(food.per100.carbs)}</b></span>
                    <span className="tone-fat"><i />F <b>{roundMacro(food.per100.fat)}</b></span>
                    <span className="muted small">per 100 g</span>
                  </div>
                  <div className="row gap">
                    <button className="btn ghost small" type="button" onClick={() => setEditing(food)}><Icon name="edit" size={15} />Edit</button>
                    <ConfirmButton icon="trash" confirmText="Delete?" onConfirm={() => deleteCustomFood(food.id)}>Delete</ConfirmButton>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
        <aside className="card stack sticky-col">
          <h2 className="section-title">Copy from the food list</h2>
          <p className="muted small">Save a built-in food to tweak it or keep it at the top of search.</p>
          <SearchField value={query} onChange={setQuery} placeholder="Chicken, 米饭, oats" label="Search the food list" />
          <div className="result-list">
            {results.map((food) => {
              const listed = state.customFoods.some((item) => item.sourceId === food.id)
              return (
                <div key={food.id} className="result static">
                  <span className="result-main"><strong>{food.name}</strong><small>{roundKcal(food.per100.kcal)} kcal / 100 g{cjkAlias(food) ? ` · ${cjkAlias(food)}` : ''}</small></span>
                  <button className={`btn small ${listed ? 'soft' : 'ghost'}`} type="button" disabled={listed} onClick={() => listFood(food)}>{listed ? <><Icon name="check" size={14} />Saved</> : <><Icon name="plus" size={14} />Save</>}</button>
                </div>
              )
            })}
            {query.trim() && results.length === 0 && <p className="muted small">Nothing matches.</p>}
          </div>
        </aside>
      </div>

      {creating && (
        <Modal title="Create a food" onClose={() => setCreating(false)} size="md">
          <FoodForm submitLabel="Save food" onCancel={() => setCreating(false)} onSave={(food) => { saveCustomFood(food); setCreating(false); flash(`${food.name} saved`) }} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)} size="md">
          <FoodForm initial={foodToForm(editing)} base={editing} submitLabel="Save changes" onCancel={() => setEditing(null)} onSave={(food) => { saveCustomFood(food); setEditing(null); flash('Food updated') }} />
        </Modal>
      )}
    </div>
  )
}
