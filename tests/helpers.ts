import type { Modality, Session, Workout } from '@/types'
import { createSession, completeSession } from '@/services/sessions'

export function mod(id: string, name = id, logType: Modality['logType'] = 'sets'): Modality {
  return { id, name, color: '#6366f1', category: 'outro', logType, order: 0, active: true, createdAt: 1 }
}

export function seq(modalityId: string, names: string[]): Workout[] {
  return names.map((name, i) => ({
    id: `${modalityId}-${name}`,
    modalityId,
    name,
    position: i,
    description: '',
    notes: '',
    goal: '',
    active: true,
    exercises: [{ id: `${name}-e1`, name: 'Agachamento', sets: 3, reps: '10', load: 20, unit: 'kg', notes: '' }],
    createdAt: 1
  }))
}

let clock = 1_000_000
export function done(date: string, modality: Modality, workout: Workout, suggested: Workout | null = workout): Session {
  clock += 1000
  const s = createSession({ date, modality, workout, suggestedWorkoutId: suggested?.id ?? null, now: clock })
  return completeSession(s, clock + 500)
}
