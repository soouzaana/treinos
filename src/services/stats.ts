import type { DaySwap, Modality, Session, WeekPlanDay } from '@/types'
import { addDays, weekdayOf } from '@/utils/date'
import { applySwaps } from './substitution'

export interface RangeStats {
  planned: number
  completed: number // concluídas que estavam previstas
  extra: number // concluídas fora do planejamento
  started: number // iniciadas e não concluídas
  skipped: number // registradas como não realizadas
  notDone: number // previstas sem conclusão (dias passados)
  rate: number | null // 0..100
}

function listDates(from: string, to: string): string[] {
  const out: string[] = []
  let d = from
  let guard = 0
  while (d <= to && guard++ < 4000) {
    out.push(d)
    d = addDays(d, 1)
  }
  return out
}

/** Modalidades previstas na data, já com as substituições (ex.: Musculação → Treino em Casa). */
function plannedFor(date: string, plan: WeekPlanDay[], activeIds: Set<string>, swaps: DaySwap[]): string[] {
  const day = plan.find((p) => p.weekday === weekdayOf(date))
  if (!day || day.rest) return []
  return applySwaps(day.modalityIds.filter((id) => activeIds.has(id)), swaps, date, (id) => activeIds.has(id))
}

/**
 * Estatísticas de um intervalo [from, to]. "Previsto" usa o planejamento semanal vigente
 * (o app não guarda um retrato do plano por dia). Dias futuros não entram como "não realizado".
 */
export function rangeStats(
  from: string,
  to: string,
  today: string,
  plan: WeekPlanDay[],
  modalities: Modality[],
  sessions: Session[],
  modalityId?: string,
  swaps: DaySwap[] = []
): RangeStats {
  const active = new Set(modalities.filter((m) => m.active).map((m) => m.id))
  const dates = listDates(from, to)
  const inRange = sessions.filter((s) => s.date >= from && s.date <= to && (!modalityId || s.modalityId === modalityId))
  const key = (d: string, m: string) => `${d}|${m}`
  const sessMap = new Map(inRange.map((s) => [key(s.date, s.modalityId), s]))
  let planned = 0
  let completed = 0
  let notDone = 0
  const plannedKeys = new Set<string>()
  for (const d of dates) {
    let ids = plannedFor(d, plan, active, swaps)
    if (modalityId) ids = ids.filter((i) => i === modalityId)
    for (const m of ids) {
      planned += 1
      plannedKeys.add(key(d, m))
      const s = sessMap.get(key(d, m))
      if (s?.status === 'completed') completed += 1
      else if (d < today) notDone += 1
    }
  }
  const extra = inRange.filter((s) => s.status === 'completed' && !plannedKeys.has(key(s.date, s.modalityId))).length
  const started = inRange.filter((s) => s.status === 'in_progress').length
  const skipped = inRange.filter((s) => s.status === 'skipped').length
  return { planned, completed, extra, started, skipped, notDone, rate: planned > 0 ? Math.round((completed / planned) * 100) : null }
}

export function countCompleted(sessions: Session[], modalityId: string): number {
  return sessions.filter((s) => s.modalityId === modalityId && s.status === 'completed').length
}

/**
 * Sequência atual: quantos dias previstos consecutivos (do mais recente para trás) foram concluídos,
 * sem nenhuma falta no meio. O dia de hoje, se ainda pendente, não quebra a sequência.
 * Treinos concluídos fora do planejamento não entram na contagem.
 */
export function currentStreak(
  modalityId: string,
  today: string,
  plan: WeekPlanDay[],
  sessions: Session[],
  maxDays = 400,
  swaps: DaySwap[] = []
): number {
  const done = new Set(sessions.filter((s) => s.modalityId === modalityId && s.status === 'completed').map((s) => s.date))
  let streak = 0
  let d = today
  for (let i = 0; i < maxDays; i++) {
    const day = plan.find((p) => p.weekday === weekdayOf(d))
    const planned = !!day && !day.rest && applySwaps(day.modalityIds, swaps, d).includes(modalityId)
    if (planned) {
      if (done.has(d)) streak += 1
      else if (d !== today) break
    }
    d = addDays(d, -1)
  }
  return streak
}
