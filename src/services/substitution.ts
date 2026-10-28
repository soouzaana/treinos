import type { DaySwap, Modality } from '@/types'

/**
 * Substituição de modalidade (ex.: Musculação → Treino em Casa). Funções puras.
 * NÃO existe contador de rotação aqui: a sequência de cada modalidade continua derivada das
 * sessões concluídas (rotation.ts). Substituir só muda QUAL modalidade ocupa o lugar no dia.
 */

export const HOME_NAME = 'Treino em Casa'
export const HOME_WORKOUT_COUNT = 4

const norm = (s: string) => s.trim().toLowerCase()

/** Modalidade de treino em casa: categoria "casa" ou, na falta, o nome "Treino em Casa". */
export function findHomeModality(modalities: Modality[], onlyActive = true): Modality | null {
  const pool = [...modalities].filter((m) => !onlyActive || m.active).sort((a, b) => a.order - b.order)
  return pool.find((m) => m.category === 'casa') ?? pool.find((m) => norm(m.name) === norm(HOME_NAME)) ?? null
}

export const swapKey = (date: string, fromModalityId: string) => `${date}|${fromModalityId}`

export function swapFrom(swaps: DaySwap[], date: string, fromModalityId: string): DaySwap | undefined {
  return swaps.find((s) => s.date === date && s.fromModalityId === fromModalityId)
}

export function swapTo(swaps: DaySwap[], date: string, toModalityId: string): DaySwap | undefined {
  return swaps.find((s) => s.date === date && s.toModalityId === toModalityId)
}

/**
 * Aplica as substituições do dia à lista de modalidades previstas, mantendo a ordem de
 * apresentação. Se o destino já estava previsto no dia, não duplica.
 */
export function applySwaps(plannedIds: string[], swaps: DaySwap[], date: string, isActive: (id: string) => boolean = () => true): string[] {
  const out: string[] = []
  for (const id of plannedIds) {
    const sw = swapFrom(swaps, date, id)
    const final = sw && isActive(sw.toModalityId) ? sw.toModalityId : id
    if (!out.includes(final)) out.push(final)
  }
  return out
}

/** Pode substituir? Só quando a modalidade de origem ainda não tem registro no dia (nada a descartar). */
export function canSubstitute(from: Modality, to: Modality | null, hasFromSession: boolean, hasSwap: boolean): boolean {
  return !!to && from.id !== to.id && from.category === 'musculacao' && !hasFromSession && !hasSwap
}
