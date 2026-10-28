import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import type { DaySwap, ExerciseLog, Modality, Session, Workout } from '@/types'
import { completeSession, createSession, reopenSession, skipSession, switchWorkout } from '@/services/sessions'
import { nextPending, sessionId, suggestWorkout } from '@/services/rotation'
import { canSubstitute, swapFrom, swapTo } from '@/services/substitution'
import { useModalitiesStore } from './modalities'

/**
 * Store de execução + histórico. As sessões são a única fonte de verdade da rotação:
 * nada de "contador de posição" guardado — a sugestão é sempre derivada das sessões concluídas.
 */
export const SWAPS_KEY = 'daySwaps'

function isSwap(v: unknown): v is DaySwap {
  const o = v as Partial<DaySwap> | null
  return !!o && typeof o.date === 'string' && typeof o.fromModalityId === 'string' && typeof o.toModalityId === 'string'
}

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<Session[]>([])
  /** Substituições de modalidade por dia (ex.: Musculação → Treino em Casa). Persistidas em settings. */
  const swaps = ref<DaySwap[]>([])
  const error = ref<string | null>(null)

  async function load() {
    try {
      sessions.value = await db.sessions.toArray()
      const row = await db.settings.get(SWAPS_KEY)
      swaps.value = Array.isArray(row?.value) ? (row!.value as unknown[]).filter(isSwap) : []
    } catch (e) {
      error.value = 'Não foi possível carregar o histórico.'
      console.error(e)
    }
  }

  const get = (date: string, modalityId: string) => sessions.value.find((s) => s.id === sessionId(date, modalityId))
  const byDate = (date: string) => sessions.value.filter((s) => s.date === date)
  const inProgress = computed(() => sessions.value.filter((s) => s.status === 'in_progress'))

  async function persist(s: Session) {
    try {
      await db.sessions.put(JSON.parse(JSON.stringify(s)))
      const i = sessions.value.findIndex((x) => x.id === s.id)
      if (i >= 0) sessions.value[i] = s
      else sessions.value.push(s)
      error.value = null
    } catch (e) {
      error.value = 'Falha ao salvar o registro. Tente novamente.'
      console.error(e)
      throw e
    }
  }

  function suggestionFor(modalityId: string, date?: string, excludeSessionId?: string): Workout | null {
    const m = useModalitiesStore()
    return suggestWorkout(m.workouts, sessions.value, modalityId, { beforeDate: date, excludeSessionId })
  }

  function nextFor(modalityId: string): Workout | null {
    return nextPending(useModalitiesStore().workouts, sessions.value, modalityId)
  }

  async function persistSwaps(next: DaySwap[]) {
    try {
      await db.settings.put({ key: SWAPS_KEY, value: JSON.parse(JSON.stringify(next)) })
      swaps.value = next
      error.value = null
    } catch (e) {
      error.value = 'Falha ao salvar a substituição. Tente novamente.'
      console.error(e)
      throw e
    }
  }

  const swapOf = (date: string, fromModalityId: string) => swapFrom(swaps.value, date, fromModalityId)
  const swapsOn = (date: string) => swaps.value.filter((s) => s.date === date)

  /** Dados da substituição que a sessão da modalidade `modalityId` naquele dia deve registrar, se houver. */
  function replacesFor(date: string, modalityId: string) {
    const sw = swapTo(swaps.value, date, modalityId)
    return sw ? { modalityId: sw.fromModalityId, workoutId: sw.originalWorkoutId, workoutName: sw.originalWorkoutName } : null
  }

  /**
   * Substitui, no dia, a modalidade `from` (musculação) por `to` (treino em casa). Só é permitido
   * enquanto `from` não tem registro no dia — assim nada é descartado. Não mexe no planejamento
   * semanal nem em nenhuma sequência: as duas rotações seguem derivadas das sessões concluídas.
   */
  async function substitute(date: string, from: Modality, to: Modality): Promise<DaySwap> {
    if (swapTo(swaps.value, date, to.id)) throw new Error(`${to.name} já está substituindo outra modalidade neste dia.`)
    if (!canSubstitute(from, to, !!get(date, from.id), !!swapOf(date, from.id)))
      throw new Error(`Não é possível substituir ${from.name} neste dia: já existe registro ou substituição.`)
    const original = suggestionFor(from.id, date)
    const sw: DaySwap = {
      date,
      fromModalityId: from.id,
      toModalityId: to.id,
      originalWorkoutId: original?.id ?? null,
      originalWorkoutName: original?.name ?? null,
      createdAt: Date.now()
    }
    await persistSwaps([...swaps.value, sw])
    const existing = get(date, to.id)
    if (existing && existing.replacesModalityId !== from.id) {
      await persist({ ...existing, replacesModalityId: from.id, replacesWorkoutId: sw.originalWorkoutId, replacesWorkoutName: sw.originalWorkoutName, updatedAt: Date.now() })
    }
    return sw
  }

  /**
   * Desfaz a substituição e devolve a modalidade original ao dia. Se o treino substituto já foi
   * iniciado/registrado, NADA é apagado sem `force`: devolve 'needs-confirm' para a tela pedir
   * uma ação explícita. Registro "não realizado" (sem dados) é removido sem pedir.
   */
  async function cancelSubstitution(date: string, fromModalityId: string, force = false): Promise<'cancelled' | 'needs-confirm'> {
    const sw = swapOf(date, fromModalityId)
    if (!sw) return 'cancelled'
    const s = get(date, sw.toModalityId)
    const own = s && s.replacesModalityId === fromModalityId ? s : undefined
    if (own && own.status !== 'skipped' && !force) return 'needs-confirm'
    if (own) await removeSession(own.id)
    await persistSwaps(swaps.value.filter((x) => x !== sw))
    return 'cancelled'
  }

  /** Inicia (ou retoma) a sessão do dia para a modalidade. Nunca duplica (id = data + modalidade). */
  async function start(date: string, modality: Modality, workout?: Workout): Promise<Session | null> {
    const existing = get(date, modality.id)
    if (existing && (existing.status === 'in_progress' || existing.status === 'completed')) return existing
    const suggested = suggestionFor(modality.id, date, existing?.id)
    const chosen = workout ?? suggested
    if (!chosen) return null
    let s = createSession({ date, modality, workout: chosen, suggestedWorkoutId: suggested?.id ?? null, replaces: replacesFor(date, modality.id) })
    if (existing) s = { ...s, createdAt: existing.createdAt }
    await persist(s)
    return s
  }

  async function update(s: Session) {
    await persist({ ...s, updatedAt: Date.now() })
  }

  async function complete(date: string, modality: Modality, workout?: Workout): Promise<Session | null> {
    let s: Session | null | undefined = get(date, modality.id)
    const fresh = !s || s.status === 'skipped'
    if (fresh) s = await start(date, modality, workout)
    if (!s) return null
    let c = completeSession(s)
    // conclusão rápida (sem ter iniciado o treino): não há duração real a registrar
    if (fresh && c !== s) c = { ...c, startedAt: null, durationSec: null }
    if (c !== s) await persist(c)
    return c
  }

  async function skip(date: string, modality: Modality): Promise<Session | null> {
    const existing = get(date, modality.id)
    if (existing?.status === 'completed') return existing
    const suggested = suggestionFor(modality.id, date, existing?.id)
    const w = existing ? useModalitiesStore().getWorkout(existing.workoutId) ?? suggested : suggested
    if (!w) return null
    const base = existing ?? createSession({ date, modality, workout: w, suggestedWorkoutId: suggested?.id ?? null, replaces: replacesFor(date, modality.id) })
    const s = skipSession({ ...base, startedAt: null })
    await persist(s)
    return s
  }

  /** Desfaz "não treinei" (volta o dia a pendente). */
  async function clearSkip(date: string, modalityId: string) {
    const s = get(date, modalityId)
    if (s?.status !== 'skipped') return
    await removeSession(s.id)
  }

  async function reopen(id: string) {
    const s = sessions.value.find((x) => x.id === id)
    if (s) await persist(reopenSession(s))
  }

  async function changeWorkout(id: string, workout: Workout, modality: Modality) {
    const s = sessions.value.find((x) => x.id === id)
    if (s) await persist(switchWorkout(s, workout, modality))
  }

  async function removeSession(id: string) {
    await db.sessions.delete(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
  }

  async function updateExercises(id: string, exercises: ExerciseLog[]) {
    const s = sessions.value.find((x) => x.id === id)
    if (s) await persist({ ...s, exercises, updatedAt: Date.now() })
  }

  return { sessions, swaps, error, inProgress, load, swapOf, swapsOn, substitute, cancelSubstitution, get, byDate, suggestionFor, nextFor, start, update, complete, skip, clearSkip, reopen, changeWorkout, removeSession, updateExercises }
})
