import { useState } from 'react'
import { useStore } from '../store.jsx'
import { useRoute } from '../router.jsx'
import { newId } from '../lib/nutrition.js'
import { exercises } from '../data/exercises.js'
import { ExerciseBrowser, ExerciseDetail } from '../components/Exercises.jsx'
import { PageHead } from '../components/ui.jsx'

export function ExercisesPage() {
  const { draft, setDraft, setPendingStart, flash } = useStore()
  const { go } = useRoute()
  const [detail, setDetail] = useState(null)

  function add(exercise) {
    if (draft) {
      setDraft((current) => ({
        ...current,
        exercises: [...current.exercises, {
          id: newId(),
          exerciseId: exercise.id,
          targetReps: exercise.logging === 'cardio' ? '10' : '8-12',
          restSec: exercise.logging === 'cardio' ? 0 : 90,
          sets: [{ id: newId(), reps: '', weight: '', done: false }],
        }],
      }))
      flash(`${exercise.title} added to ${draft.name}`)
    } else {
      setPendingStart({ exerciseId: exercise.id })
      go('train')
    }
    setDetail(null)
  }

  return (
    <div className="page stack-lg">
      <PageHead eyebrow="Training" title="Exercise library">
        <p className="muted">{exercises.length.toLocaleString()} exercises with animations and step-by-step form cues, in English and 中文.</p>
      </PageHead>
      <ExerciseBrowser mode="library" onOpen={setDetail} />
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} onAdd={() => add(detail)} addLabel={draft ? 'Add to current workout' : 'Start a workout with it'} />}
    </div>
  )
}
