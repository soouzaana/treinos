import type { ExerciseLog, Modality, Session, Workout } from '@/types'
import { sessionId } from './rotation'

/** Cria o esqueleto de registro de exercícios a partir de um treino cadastrado. */
export function buildExerciseLogs(workout: Workout, modality?: Modality): ExerciseLog[] {
  const withSets = (modality?.logType ?? 'sets') === 'sets'
  return workout.exercises.map((e) => ({
    exerciseId: e.id,
    name: e.name,
    unit: e.unit || 'kg',
    plannedSets: e.sets,
    plannedReps: e.reps,
    plannedLoad: e.load,
    plannedDurationSec: e.durationSec ?? null,
    plannedRestSec: e.restSec ?? null,
    done: false,
    sets: withSets
      ? Array.from({ length: Math.max(0, e.sets) }, (_, i) => ({
          n: i + 1,
          load: e.load,
          reps: null,
          done: false,
          notes: ''
        }))
      : []
  }))
}

export interface NewSessionInput {
  date: string
  modality: Modality
  workout: Workout
  suggestedWorkoutId: string | null
  /** quando a sessão substitui outra modalidade planejada no dia (ver DaySwap) */
  replaces?: { modalityId: string; workoutId: string | null; workoutName: string | null } | null
  now?: number
}

export function createSession(input: NewSessionInput): Session {
  const now = input.now ?? Date.now()
  return {
    id: sessionId(input.date, input.modality.id),
    date: input.date,
    modalityId: input.modality.id,
    workoutId: input.workout.id,
    workoutName: input.workout.name,
    workoutPosition: input.workout.position,
    suggestedWorkoutId: input.suggestedWorkoutId,
    substituted: input.suggestedWorkoutId !== null && input.suggestedWorkoutId !== input.workout.id,
    replacesModalityId: input.replaces?.modalityId ?? null,
    replacesWorkoutId: input.replaces?.workoutId ?? null,
    replacesWorkoutName: input.replaces?.workoutName ?? null,
    status: 'in_progress',
    startedAt: now,
    completedAt: null,
    durationSec: null,
    notes: '',
    exercises: buildExerciseLogs(input.workout, input.modality),
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Conclui uma sessão. Idempotente: concluir duas vezes devolve a mesma sessão
 * (mesmo completedAt) e nunca cria registro novo.
 */
export function completeSession(session: Session, now: number = Date.now()): Session {
  if (session.status === 'completed') return session
  const started = session.startedAt ?? now
  return {
    ...session,
    status: 'completed',
    completedAt: now,
    startedAt: session.startedAt ?? now,
    durationSec: Math.max(0, Math.round((now - started) / 1000)),
    updatedAt: now
  }
}

export function skipSession(session: Session, now: number = Date.now()): Session {
  if (session.status === 'completed') return session
  return { ...session, status: 'skipped', completedAt: null, updatedAt: now }
}

/** Reabre uma sessão concluída (correção): ela deixa de contar na rotação. */
export function reopenSession(session: Session, now: number = Date.now()): Session {
  return { ...session, status: 'in_progress', completedAt: null, durationSec: null, updatedAt: now }
}

/** Troca o treino executado, reconstruindo os exercícios (mantém séries se o treino for o mesmo). */
export function switchWorkout(session: Session, workout: Workout, modality: Modality, now: number = Date.now()): Session {
  if (session.workoutId === workout.id) return session
  return {
    ...session,
    workoutId: workout.id,
    workoutName: workout.name,
    workoutPosition: workout.position,
    substituted: session.suggestedWorkoutId !== null && session.suggestedWorkoutId !== workout.id,
    exercises: buildExerciseLogs(workout, modality),
    updatedAt: now
  }
}
