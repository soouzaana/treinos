import type { TafEvaluation, TafStatus, TafTest } from '@/types'

export function percentOfGoal(test: Pick<TafTest, 'direction'>, result: number, goal: number | null): number | null {
  if (goal === null || goal <= 0 || result < 0) return null
  if (test.direction === 'lower') return result <= 0 ? null : (goal / result) * 100
  return (result / goal) * 100
}

export function meetsTarget(test: Pick<TafTest, 'direction'>, result: number, target: number): boolean {
  return test.direction === 'lower' ? result <= target : result >= target
}

/** Ritmo médio em min/km. distanceM em metros, durationSec em segundos. */
export function paceMinPerKm(distanceM: number, durationSec: number): number | null {
  if (distanceM <= 0 || durationSec <= 0) return null
  return durationSec / 60 / (distanceM / 1000)
}

export function formatPace(pace: number | null): string {
  if (pace === null || !isFinite(pace)) return '—'
  let min = Math.floor(pace)
  let sec = Math.round((pace - min) * 60)
  if (sec === 60) {
    min += 1
    sec = 0
  }
  return `${min}:${String(sec).padStart(2, '0')} min/km`
}

export function sortedEvals(evals: TafEvaluation[], testId: string, kind?: TafEvaluation['kind']): TafEvaluation[] {
  return evals
    .filter((e) => e.testId === testId && (!kind || e.kind === kind))
    .sort((a, b) => (a.date + String(a.createdAt).padStart(15, '0')).localeCompare(b.date + String(b.createdAt).padStart(15, '0')))
}

export interface TafComparison {
  previous: TafEvaluation
  current: TafEvaluation
  delta: number
  improved: boolean | null // null = igual
}

export function compareWithPrevious(test: Pick<TafTest, 'direction'>, list: TafEvaluation[]): TafComparison | null {
  if (list.length < 2) return null
  const previous = list[list.length - 2]
  const current = list[list.length - 1]
  const delta = current.result - previous.result
  const improved = delta === 0 ? null : test.direction === 'lower' ? delta < 0 : delta > 0
  return { previous, current, delta, improved }
}

/**
 * Situação frente à META PESSOAL:
 *  - achieved: último resultado atinge a meta;
 *  - progress: abaixo da meta, porém melhor que a avaliação anterior;
 *  - below: abaixo da meta sem melhora (ou única avaliação);
 *  - nogoal: meta não cadastrada / sem avaliações.
 */
export function personalStatus(test: TafTest, list: TafEvaluation[]): TafStatus {
  if (test.personalGoal === null || list.length === 0) return 'nogoal'
  const last = list[list.length - 1]
  if (meetsTarget(test, last.result, test.personalGoal)) return 'achieved'
  const cmp = compareWithPrevious(test, list)
  return cmp && cmp.improved ? 'progress' : 'below'
}

export type OfficialStatus = 'meets' | 'not_meets' | 'none'

/** Situação frente à referência oficial cadastrada (nunca afirma aprovação). */
export function officialStatus(test: TafTest, list: TafEvaluation[]): OfficialStatus {
  if (test.officialRef === null || list.length === 0) return 'none'
  const last = list[list.length - 1]
  return meetsTarget(test, last.result, test.officialRef) ? 'meets' : 'not_meets'
}

export const STATUS_LABEL: Record<TafStatus, string> = {
  achieved: 'Meta atingida',
  progress: 'Em progresso',
  below: 'Abaixo da meta',
  nogoal: 'Sem meta'
}

/** Provas sugeridas (sem metas e sem critérios oficiais — o usuário configura conforme o edital). */
export const SUGGESTED_TESTS: Array<Omit<TafTest, 'id' | 'order'>> = [
  { name: 'Corrida de 12 minutos', unit: 'm', kind: 'distance', direction: 'higher', durationSec: 720, protocol: 'Distância percorrida em 12 minutos', personalGoal: null, officialRef: null, officialSource: '', active: true },
  { name: 'Abdominal em 60 segundos', unit: 'rep', kind: 'reps', direction: 'higher', durationSec: 60, protocol: 'Repetições válidas em 60 segundos', personalGoal: null, officialRef: null, officialSource: '', active: true },
  { name: 'Barra isométrica', unit: 's', kind: 'time', direction: 'higher', durationSec: null, protocol: 'Tempo sustentado', personalGoal: null, officialRef: null, officialSource: '', active: true },
  { name: 'Flexão de braços', unit: 'rep', kind: 'reps', direction: 'higher', durationSec: null, protocol: 'Repetições válidas (protocolo a definir)', personalGoal: null, officialRef: null, officialSource: '', active: true }
]
