/**
 * Cronômetro de descanso baseado em timestamps (não em contador decrementado por tick).
 * Estado serializável: pode ser salvo e recuperado após troca de tela / reload.
 */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface TimerState {
  status: TimerStatus
  durationMs: number
  /** instante (epoch ms) em que termina — válido em 'running' e 'finished' */
  endAt: number | null
  /** tempo restante congelado — válido em 'paused' */
  remainingMs: number | null
}

export const PRESETS_SEC = [30, 45, 60, 90, 120, 180]

export const idleTimer = (durationMs = 60000): TimerState => ({ status: 'idle', durationMs, endAt: null, remainingMs: null })

export function startTimer(durationMs: number, now: number): TimerState {
  return { status: 'running', durationMs, endAt: now + durationMs, remainingMs: null }
}

export function remainingMs(t: TimerState, now: number): number {
  switch (t.status) {
    case 'running':
      return Math.max(0, (t.endAt ?? now) - now)
    case 'paused':
      return t.remainingMs ?? t.durationMs
    case 'finished':
      return 0
    default:
      return t.durationMs
  }
}

/** Atualiza o estado conforme o relógio: running → finished quando o tempo acaba. */
export function syncTimer(t: TimerState, now: number): TimerState {
  if (t.status === 'running' && (t.endAt ?? 0) <= now) return { ...t, status: 'finished', remainingMs: 0 }
  return t
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  const s = syncTimer(t, now)
  if (s.status !== 'running') return s
  return { ...s, status: 'paused', remainingMs: remainingMs(s, now), endAt: null }
}

export function resumeTimer(t: TimerState, now: number): TimerState {
  if (t.status !== 'paused') return t
  const rem = t.remainingMs ?? t.durationMs
  return { ...t, status: 'running', endAt: now + rem, remainingMs: null }
}

/** Reinicia com a mesma duração. */
export function restartTimer(t: TimerState, now: number): TimerState {
  return startTimer(t.durationMs, now)
}

export function resetTimer(t: TimerState): TimerState {
  return idleTimer(t.durationMs)
}

/** Quanto tempo se passou desde que terminou (para avisar "terminou em segundo plano"). */
export function finishedAgoMs(t: TimerState, now: number): number {
  if (t.status !== 'finished' || t.endAt === null) return 0
  return Math.max(0, now - t.endAt)
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
