import type { Evolution, Session, SetLog } from '@/types'
import { normalizeName } from '@/utils/id'

export interface ExerciseSessionSummary {
  date: string
  sessionId: string
  completedAt: number
  doneSets: number
  maxLoad: number
  repsAtMaxLoad: number
  avgLoad: number
  totalReps: number
  volume: number
  unit: string
}

export interface ExerciseComparison {
  previous: ExerciseSessionSummary
  current: ExerciseSessionSummary
  evolution: Evolution
  reasons: string[]
}

export function exerciseKey(name: string): string {
  return normalizeName(name)
}

function doneSets(sets: SetLog[]): SetLog[] {
  return sets.filter((s) => s.done && (s.reps ?? 0) > 0)
}

export function summarizeSets(sets: SetLog[]): Omit<ExerciseSessionSummary, 'date' | 'sessionId' | 'completedAt' | 'unit'> | null {
  const d = doneSets(sets)
  if (d.length === 0) return null
  const loads = d.map((s) => s.load ?? 0)
  const maxLoad = Math.max(...loads)
  const repsAtMaxLoad = Math.max(...d.filter((s) => (s.load ?? 0) === maxLoad).map((s) => s.reps ?? 0))
  const totalReps = d.reduce((a, s) => a + (s.reps ?? 0), 0)
  return {
    doneSets: d.length,
    maxLoad,
    repsAtMaxLoad,
    avgLoad: loads.reduce((a, b) => a + b, 0) / loads.length,
    totalReps,
    volume: d.reduce((a, s) => a + (s.reps ?? 0) * (s.load ?? 0), 0)
  }
}

/** Histórico de um exercício (por nome normalizado), das sessões concluídas, em ordem cronológica. */
export function exerciseHistory(sessions: Session[], key: string): ExerciseSessionSummary[] {
  const out: ExerciseSessionSummary[] = []
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    for (const ex of s.exercises) {
      if (exerciseKey(ex.name) !== key) continue
      const sum = summarizeSets(ex.sets)
      if (!sum) continue
      out.push({ ...sum, date: s.date, sessionId: s.id, completedAt: s.completedAt ?? 0, unit: ex.unit })
    }
  }
  return out.sort((a, b) => (a.date + String(a.completedAt).padStart(15, '0')).localeCompare(b.date + String(b.completedAt).padStart(15, '0')))
}

/** Redução de carga média acima disto invalida o ganho de uma série adicional. */
const RELEVANT_LOAD_DROP = 0.1

/**
 * Compara execuções equivalentes. Evolução = melhora em pelo menos um critério:
 *  1. aumento da carga máxima;
 *  2. mesma carga (ou maior) com mais repetições;
 *  3. mais séries concluídas com desempenho comparável (carga média sem queda relevante
 *     e repetições na carga máxima não menores).
 * Regressão = queda de carga máxima, ou mesma carga com menos repetições.
 */
export function compareSessions(previous: ExerciseSessionSummary, current: ExerciseSessionSummary): ExerciseComparison {
  const reasons: string[] = []
  let evolved = false
  let regressed = false

  if (current.maxLoad > previous.maxLoad) {
    evolved = true
    reasons.push(`Carga máxima subiu de ${previous.maxLoad} para ${current.maxLoad} ${current.unit}`)
  } else if (current.maxLoad < previous.maxLoad) {
    regressed = true
    reasons.push(`Carga máxima caiu de ${previous.maxLoad} para ${current.maxLoad} ${current.unit}`)
  } else {
    if (current.repsAtMaxLoad > previous.repsAtMaxLoad) {
      evolved = true
      reasons.push(`Mais repetições com ${current.maxLoad} ${current.unit} (${previous.repsAtMaxLoad} → ${current.repsAtMaxLoad})`)
    } else if (current.repsAtMaxLoad < previous.repsAtMaxLoad) {
      regressed = true
      reasons.push(`Menos repetições com ${current.maxLoad} ${current.unit} (${previous.repsAtMaxLoad} → ${current.repsAtMaxLoad})`)
    }
    if (!evolved && !regressed && current.doneSets > previous.doneSets) {
      const comparable = previous.avgLoad === 0 ? true : current.avgLoad >= previous.avgLoad * (1 - RELEVANT_LOAD_DROP)
      if (comparable) {
        evolved = true
        reasons.push(`Mais séries concluídas (${previous.doneSets} → ${current.doneSets}) com desempenho comparável`)
      } else {
        reasons.push('Série adicional com carga média bem menor: não contada como evolução')
      }
    }
    if (!evolved && !regressed && current.doneSets < previous.doneSets) {
      reasons.push(`Menos séries concluídas (${previous.doneSets} → ${current.doneSets})`)
    }
  }

  const evolution: Evolution = regressed ? 'regressao' : evolved ? 'evolucao' : 'manutencao'
  if (evolution === 'manutencao' && reasons.length === 0) reasons.push('Desempenho equivalente ao da sessão anterior')
  return { previous, current, evolution, reasons }
}

export function compareLastTwo(history: ExerciseSessionSummary[]): ExerciseComparison | null {
  if (history.length < 2) return null
  return compareSessions(history[history.length - 2], history[history.length - 1])
}

export interface ExerciseIndexItem {
  key: string
  name: string
  sessions: number
  lastDate: string
}

/** Lista de todos os exercícios que já tiveram séries registradas em sessões concluídas. */
export function exerciseIndex(sessions: Session[]): ExerciseIndexItem[] {
  const map = new Map<string, ExerciseIndexItem>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    for (const ex of s.exercises) {
      if (!summarizeSets(ex.sets)) continue
      const key = exerciseKey(ex.name)
      const cur = map.get(key)
      if (!cur) map.set(key, { key, name: ex.name, sessions: 1, lastDate: s.date })
      else {
        cur.sessions += 1
        if (s.date > cur.lastDate) cur.lastDate = s.date
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
