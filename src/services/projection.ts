import type { Modality, Session, WeekPlanDay, Workout } from '@/types'
import { addDays, weekdayOf } from '@/utils/date'
import { completedOf, nextAfter, sequenceOf } from './rotation'

export interface ProjectedItem {
  modalityId: string
  /** treino que a rotação indica para aquele dia (ou o realmente executado, se já houver sessão) */
  workout: Workout | null
  workoutName: string | null
  state: 'projected' | 'completed' | 'in_progress' | 'skipped'
}

export interface ProjectedDay {
  date: string
  weekday: number
  rest: boolean
  items: ProjectedItem[]
}

type Last = { workoutId: string; workoutPosition: number } | null

/**
 * Projeta os próximos `days` dias a partir de `from`, assumindo que cada treino previsto será
 * concluído em ordem. Sessões já registradas prevalecem sobre a projeção. Não grava nada.
 * Se a mesma modalidade aparece duas vezes no ciclo, cada ocorrência recebe o treino seguinte.
 */
export function projectDays(
  from: string,
  days: number,
  plan: WeekPlanDay[],
  modalities: Modality[],
  workouts: Workout[],
  sessions: Session[]
): ProjectedDay[] {
  const active = new Set(modalities.filter((m) => m.active).map((m) => m.id))
  const last = new Map<string, Last>()
  const lastBefore = (modalityId: string): Last => {
    const done = completedOf(sessions, modalityId).filter((s) => s.date < from)
    const l = done[done.length - 1]
    return l ? { workoutId: l.workoutId, workoutPosition: l.workoutPosition } : null
  }
  const out: ProjectedDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const weekday = weekdayOf(date)
    const p = plan.find((d) => d.weekday === weekday)
    const items: ProjectedItem[] = []
    for (const modalityId of p && !p.rest ? p.modalityIds.filter((id) => active.has(id)) : []) {
      if (!last.has(modalityId)) last.set(modalityId, lastBefore(modalityId))
      const seq = sequenceOf(workouts, modalityId)
      const sess = sessions.find((s) => s.date === date && s.modalityId === modalityId)
      if (sess && sess.status !== 'skipped') {
        last.set(modalityId, { workoutId: sess.workoutId, workoutPosition: sess.workoutPosition })
        items.push({
          modalityId,
          workout: workouts.find((w) => w.id === sess.workoutId) ?? null,
          workoutName: sess.workoutName,
          state: sess.status === 'completed' ? 'completed' : 'in_progress'
        })
        continue
      }
      if (sess?.status === 'skipped') {
        items.push({ modalityId, workout: null, workoutName: sess.workoutName, state: 'skipped' })
        continue
      }
      const w = nextAfter(seq, last.get(modalityId) ?? null)
      if (w) last.set(modalityId, { workoutId: w.id, workoutPosition: w.position })
      items.push({ modalityId, workout: w, workoutName: w?.name ?? null, state: 'projected' })
    }
    out.push({ date, weekday, rest: !!p?.rest, items })
  }
  return out
}
