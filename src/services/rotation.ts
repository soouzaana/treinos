import type { Session, Workout } from '@/types'

/**
 * Lógica de rotação — funções puras, sem dependência de UI ou banco.
 * O estado da rotação NUNCA é armazenado: é sempre derivado das sessões
 * concluídas, em ordem cronológica. Assim, corrigir o histórico recalcula tudo.
 */

export function sessionOrderKey(s: Pick<Session, 'date' | 'completedAt' | 'createdAt'>): string {
  const t = s.completedAt ?? s.createdAt ?? 0
  return `${s.date}#${String(t).padStart(15, '0')}`
}

export function sequenceOf(workouts: Workout[], modalityId: string): Workout[] {
  return workouts.filter((w) => w.modalityId === modalityId).sort((a, b) => a.position - b.position)
}

/** Sessões concluídas de uma modalidade, da mais antiga para a mais recente. */
export function completedOf(sessions: Session[], modalityId: string): Session[] {
  return sessions
    .filter((s) => s.modalityId === modalityId && s.status === 'completed')
    .sort((a, b) => sessionOrderKey(a).localeCompare(sessionOrderKey(b)))
}

/**
 * Próximo treino depois de `last`, respeitando a ordem da sequência e ignorando treinos
 * desativados. Se o treino executado foi excluído, usa a posição guardada na sessão.
 */
export function nextAfter(sequence: Workout[], last: Pick<Session, 'workoutId' | 'workoutPosition'> | null): Workout | null {
  const active = sequence.filter((w) => w.active)
  if (active.length === 0) return null
  if (!last) return active[0]
  const idxAll = sequence.findIndex((w) => w.id === last.workoutId)
  const lastPos = idxAll >= 0 ? sequence[idxAll].position : last.workoutPosition
  const after = active.find((w) => w.position > lastPos)
  return after ?? active[0]
}

export interface SuggestionOptions {
  /** Considera apenas sessões estritamente anteriores a esta data (útil p/ dias passados). */
  beforeDate?: string
  /** Ignora a sessão com este id (a própria sessão do dia). */
  excludeSessionId?: string
}

/** Treino sugerido para a modalidade, com base nas sessões efetivamente concluídas. */
export function suggestWorkout(
  workouts: Workout[],
  sessions: Session[],
  modalityId: string,
  opts: SuggestionOptions = {}
): Workout | null {
  const seq = sequenceOf(workouts, modalityId)
  let done = completedOf(sessions, modalityId)
  if (opts.excludeSessionId) done = done.filter((s) => s.id !== opts.excludeSessionId)
  if (opts.beforeDate) done = done.filter((s) => s.date < opts.beforeDate!)
  const last = done.length ? done[done.length - 1] : null
  return nextAfter(seq, last)
}

/** Para a tela "próximo treino": o que vem depois do último concluído (qualquer data). */
export function nextPending(workouts: Workout[], sessions: Session[], modalityId: string): Workout | null {
  return suggestWorkout(workouts, sessions, modalityId)
}

/** Alerta de repetição: o treino escolhido é o mesmo do último concluído da modalidade? */
export function wouldRepeatLast(sessions: Session[], modalityId: string, workoutId: string, excludeSessionId?: string): boolean {
  let done = completedOf(sessions, modalityId)
  if (excludeSessionId) done = done.filter((s) => s.id !== excludeSessionId)
  const last = done[done.length - 1]
  return !!last && last.workoutId === workoutId
}

export function sessionId(date: string, modalityId: string): string {
  return `${date}_${modalityId}`
}
