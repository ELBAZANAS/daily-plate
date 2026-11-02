import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useRoute } from '../router.jsx'
import { FoodForm, formFromParsed } from '../components/FoodForm.jsx'
import { Icon } from '../components/Icon.jsx'
import { Banner, PageHead, Segmented } from '../components/ui.jsx'
import { bestReading, parseNutritionLabel, readerTexts } from '../lib/labelParse.js'
import { mealForNow, prettyDate, todayKey } from '../lib/dates.js'
import { meals, newId, nutritionFor } from '../lib/nutrition.js'

const MAX_SIDE = 2400

// Applies the photo's own orientation, the chosen rotation, and a size cap,
// so the reader always gets an upright, reasonably sized JPEG.
async function prepareImage(file, rotation) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This picture could not be opened. Use a JPG or PNG photo (iPhone HEIC photos need converting first).')
  }
  const quarter = ((rotation % 360) + 360) % 360
  const swap = quarter === 90 || quarter === 270
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((quarter * Math.PI) / 180)
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) throw new Error('The photo could not be prepared for reading.')
  return blob
}

function summaryOf(parsed) {
  return (parsed.facts || []).map((fact) => `${fact.label}: ${fact.detail}`).join('\n')
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export function ScanPage() {
  const { saveCustomFood, addFoodItem, flash, viewDate } = useStore()
  const { go } = useRoute()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [rotation, setRotation] = useState(0)
  const [pasted, setPasted] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [rawText, setRawText] = useState('')
  const [formKey, setFormKey] = useState(0)
  const [addToDiary, setAddToDiary] = useState(true)
  const [meal, setMeal] = useState(mealForNow())
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const previewRef = useRef('')
  const day = viewDate || todayKey()

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  function acceptFile(next) {
    if (!next) return
    if (next.type && !next.type.startsWith('image/')) {
      setError('That file is not a picture.')
      return
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(next)
    previewRef.current = url
    setFile(next)
    setPreview(url)
    setRotation(0)
    setParsed(null)
    setError('')
    setStatus('')
  }

  useEffect(() => {
    function onPaste(event) {
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const image = item.getAsFile()
          if (!image) continue
          event.preventDefault()
          acceptFile(image)
          return
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  function showResult(result, text) {
    setParsed(result)
    setRawText(text)
    setFormKey((value) => value + 1)
    if (result.kcal == null) setStatus('No calorie number was found. Type it from the package, or paste the label text.')
    else setStatus('')
  }

  async function readPhoto() {
    if (!file || busy) return
    setBusy(true)
    setError('')
    setStatus('Preparing the photo…')
    try {
      const image = await prepareImage(file, rotation)
      let texts
      if (window.dailyPlate?.readLabel) {
        setStatus('Reading the label… this takes a few seconds.')
        const output = await window.dailyPlate.readLabel(new Uint8Array(await image.arrayBuffer()))
        texts = readerTexts(output)
      } else {
        const { recognizeLabel } = await import('../lib/ocr.js')
        texts = await recognizeLabel(image, (message) => setStatus(message))
      }
      const best = bestReading(texts)
      if (!best.text.trim()) throw new Error('No text was found in the photo. Get closer to the nutrition table, with good light.')
      showResult(best.parsed, best.text)
    } catch (err) {
      setStatus('')
      setError(err?.message || 'The photo could not be read. Paste the label text instead.')
    } finally {
      setBusy(false)
    }
  }

  function usePasted() {
    const result = parseNutritionLabel(pasted)
    setError('')
    showResult(result, pasted)
  }

  const found = parsed ? ['kcal', 'protein', 'carbs', 'fat'].filter((key) => parsed[key] != null).length : 0

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Food" title="Scan a nutrition label">
        <p className="muted">Photograph the nutrition table on the package — Chinese (营养成分表) and English labels both work. Anything the photo does not show stays blank; nothing is guessed.</p>
      </PageHead>
      <div className="scan-layout">
        <section className="card stack">
          <div
            className={`drop-zone ${dragging ? 'over' : ''} ${preview ? 'has-image' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]) }}
          >
            {preview ? (
              <div className="preview-frame">
                <img src={preview} alt="Nutrition label to read" style={{ transform: `rotate(${rotation}deg)` }} />
              </div>
            ) : (
              <div className="drop-hint">
                <span className="drop-icon"><Icon name="camera" size={28} /></span>
                <strong>Drop a photo here</strong>
                <span className="muted small">or press Ctrl+V to paste a screenshot</span>
              </div>
            )}
          </div>
          <div className="row gap wrap">
            <label className="btn soft">
              <Icon name="camera" size={16} />Take a photo
              <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { acceptFile(event.target.files?.[0]); event.target.value = '' }} />
            </label>
            <label className="btn ghost">
              <Icon name="image" size={16} />Choose a photo
              <input className="sr-only" type="file" accept="image/*" onChange={(event) => { acceptFile(event.target.files?.[0]); event.target.value = '' }} />
            </label>
            {preview && <button className="btn ghost" type="button" onClick={() => setRotation((value) => (value + 90) % 360)} disabled={busy}><Icon name="rotate" size={16} />Rotate</button>}
          </div>
          <button className="btn primary wide" type="button" disabled={!file || busy} onClick={readPhoto}>
            {busy ? <><span className="spinner" />Reading…</> : <><Icon name="scan" size={17} />Read the label</>}
          </button>
          {status && <Banner>{status}</Banner>}
          {error && <Banner tone="bad">{error}</Banner>}
          <details className="paste-box">
            <summary>Or paste the label text</summary>
            <div className="stack-sm">
              <textarea value={pasted} rows={6} placeholder={'营养成分表\n每100克\n能量 1580千焦\n蛋白质 6.5克\n…'} onChange={(event) => setPasted(event.target.value)} />
              <button className="btn ghost self-start" type="button" disabled={!pasted.trim() || busy} onClick={usePasted}>Use this text</button>
            </div>
          </details>
          <div className="tips">
            <strong className="small">For a clean read</strong>
            <ul className="small muted">
              <li>Fill the frame with just the nutrition table.</li>
              <li>Hold the phone straight above it, with no glare.</li>
              <li>Sideways photo? Tap Rotate before reading.</li>
            </ul>
          </div>
        </section>

        <section className="card stack">
          {parsed ? (
            <>
              <div className="section-head">
                <h2>What the label says</h2>
                <button className="btn ghost small" type="button" onClick={async () => { const ok = await copyText(summaryOf(parsed)); flash(ok ? 'Numbers copied' : 'Could not copy') }}><Icon name="copy" size={15} />Copy</button>
              </div>
              <Banner tone={found === 4 ? 'good' : 'warn'}>
                {found === 4 ? 'Calories, protein, carbs and fat were all found. Check them against the package, then save.' : `${found} of the 4 main numbers were found. Fill the blanks from the package before saving.`}
              </Banner>
              <ul className="fact-list">
                {(parsed.facts || []).map((fact) => (
                  <li key={fact.label} className={fact.detail === 'Not on the label' ? 'missing' : ''}><span>{fact.label}</span><strong>{fact.detail}</strong></li>
                ))}
              </ul>
              {parsed.notes?.map((note) => <Banner key={note} tone="warn">{note}</Banner>)}
              {rawText && (
                <details className="raw-text">
                  <summary>Text the reader saw</summary>
                  <pre>{rawText}</pre>
                </details>
              )}
              <hr className="divider" />
              <h2>Save as a food</h2>
              <div className="add-today">
                <label className="check-line">
                  <input type="checkbox" checked={addToDiary} onChange={(event) => setAddToDiary(event.target.checked)} />
                  Also log one serving on {day === todayKey() ? 'today' : prettyDate(day)}
                </label>
                {addToDiary && <Segmented label="Meal" size="small" value={meal} onChange={setMeal} options={meals.map((item) => [item.id, item.label])} />}
              </div>
              <FoodForm
                key={formKey}
                initial={formFromParsed(parsed)}
                submitLabel={addToDiary ? 'Save food and log it' : 'Save food'}
                onSave={(food) => {
                  saveCustomFood(food)
                  if (addToDiary) {
                    const serving = food.servings[1] || food.servings[0]
                    addFoodItem(day, {
                      id: newId(),
                      foodId: food.id,
                      name: food.name,
                      meal,
                      grams: serving.grams,
                      quantity: serving.grams,
                      servingLabel: 'g',
                      ...nutritionFor(food.per100, serving.grams),
                    })
                    flash(`${food.name} saved and logged`)
                    go('diary')
                  } else {
                    flash(`${food.name} saved to My foods`)
                    go('foods')
                  }
                }}
              />
            </>
          ) : (
            <div className="scan-empty">
              <span className="drop-icon"><Icon name="scan" size={28} /></span>
              <h2>The numbers land here</h2>
              <p className="muted">After you read a photo or paste the text, check calories and macros on this side, then save the food. It is added to My foods and search.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
