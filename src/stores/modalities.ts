import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import type { Exercise, Modality, ModalityCategory, Workout } from '@/types'
import { uid } from '@/utils/id'
import { sequenceOf } from '@/services/rotation'

export const CATEGORY_LABEL: Record<ModalityCategory, string> = {
  musculacao: 'Musculação',
  casa: 'Treino em casa',
  cardio: 'Cardio / corrida',
  calistenia: 'Calistenia',
  taf: 'TAF',
  outro: 'Outro'
}

export const PALETTE = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#8b5cf6', '#64748b']

export class ValidationError extends Error {}

/** Cópia sem proxies do Vue: o IndexedDB (structured clone) não grava objetos reativos. */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export function newExercise(partial: Partial<Exercise> = {}): Exercise {
  return { id: uid(), name: '', sets: 3, reps: '10', load: null, unit: 'kg', notes: '', ...partial }
}

export const useModalitiesStore = defineStore('modalities', () => {
  const modalities = ref<Modality[]>([])
  const workouts = ref<Workout[]>([])
  const error = ref<string | null>(null)

  const sortedModalities = computed(() => [...modalities.value].sort((a, b) => a.order - b.order))
  const activeModalities = computed(() => sortedModalities.value.filter((m) => m.active))

  async function load() {
    try {
      modalities.value = await db.modalities.toArray()
      workouts.value = await db.workouts.toArray()
    } catch (e) {
      error.value = 'Não foi possível carregar modalidades e treinos.'
      console.error(e)
    }
  }

  const getModality = (id: string) => modalities.value.find((m) => m.id === id)
  const getWorkout = (id: string) => workouts.value.find((w) => w.id === id)
  const workoutsOf = (modalityId: string) => sequenceOf(workouts.value, modalityId)

  async function saveModality(input: Partial<Modality> & { name: string }): Promise<Modality> {
    const name = input.name.trim()
    if (!name) throw new ValidationError('Informe o nome da modalidade.')
    const dup = modalities.value.find((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== input.id)
    if (dup) throw new ValidationError('Já existe uma modalidade com esse nome.')
    const existing = input.id ? getModality(input.id) : undefined
    const m: Modality = {
      id: existing?.id ?? uid(),
      name,
      color: input.color ?? existing?.color ?? PALETTE[modalities.value.length % PALETTE.length],
      category: input.category ?? existing?.category ?? 'outro',
      logType: input.logType ?? existing?.logType ?? 'sets',
      order: existing?.order ?? (modalities.value.length ? Math.max(...modalities.value.map((x) => x.order)) + 1 : 0),
      active: input.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt ?? Date.now()
    }
    await db.modalities.put(plain(m))
    const i = modalities.value.findIndex((x) => x.id === m.id)
    if (i >= 0) modalities.value[i] = m
    else modalities.value.push(m)
    return m
  }

  async function moveModality(id: string, dir: -1 | 1) {
    const list = sortedModalities.value
    const i = list.findIndex((m) => m.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    const a = list[i]
    const b = list[j]
    const updated = [
      { ...a, order: b.order },
      { ...b, order: a.order }
    ]
    await db.modalities.bulkPut(plain(updated))
    for (const u of updated) modalities.value[modalities.value.findIndex((m) => m.id === u.id)] = u
  }

  /** Exclui a modalidade e seus treinos. As sessões já registradas permanecem (guardam nome/posição). */
  async function deleteModality(id: string) {
    await db.transaction('rw', db.modalities, db.workouts, async () => {
      await db.modalities.delete(id)
      await db.workouts.where('modalityId').equals(id).delete()
    })
    modalities.value = modalities.value.filter((m) => m.id !== id)
    workouts.value = workouts.value.filter((w) => w.modalityId !== id)
  }

  async function saveWorkout(input: Partial<Workout> & { modalityId: string; name: string }): Promise<Workout> {
    const name = input.name.trim()
    if (!name) throw new ValidationError('Informe o nome do treino.')
    if (!getModality(input.modalityId)) throw new ValidationError('Modalidade inválida.')
    const siblings = workoutsOf(input.modalityId)
    const existing = input.id ? getWorkout(input.id) : undefined
    const dup = siblings.find((w) => w.name.toLowerCase() === name.toLowerCase() && w.id !== input.id)
    if (dup) throw new ValidationError('Já existe um treino com esse nome nesta modalidade.')
    const exercises = (input.exercises ?? existing?.exercises ?? []).map((e) => {
      if (!e.name.trim()) throw new ValidationError('Todo exercício precisa de um nome.')
      if (!(e.sets >= 0) || e.sets > 50) throw new ValidationError(`Séries inválidas em "${e.name}".`)
      if (e.load !== null && !(e.load >= 0)) throw new ValidationError(`Carga inválida em "${e.name}".`)
      for (const [label, v] of [['Duração', e.durationSec], ['Descanso', e.restSec]] as const) {
        if (v !== undefined && v !== null && !(v >= 0 && v <= 36000)) throw new ValidationError(`${label} inválido em "${e.name}".`)
      }
      return { ...e, name: e.name.trim() }
    })
    const w: Workout = {
      id: existing?.id ?? uid(),
      modalityId: input.modalityId,
      name,
      position: existing?.position ?? (siblings.length ? Math.max(...siblings.map((x) => x.position)) + 1 : 0),
      description: input.description ?? existing?.description ?? '',
      notes: input.notes ?? existing?.notes ?? '',
      goal: input.goal ?? existing?.goal ?? '',
      active: input.active ?? existing?.active ?? true,
      exercises,
      createdAt: existing?.createdAt ?? Date.now()
    }
    await db.workouts.put(JSON.parse(JSON.stringify(w)))
    const i = workouts.value.findIndex((x) => x.id === w.id)
    if (i >= 0) workouts.value[i] = w
    else workouts.value.push(w)
    return w
  }

  async function duplicateWorkout(id: string): Promise<Workout | null> {
    const src = getWorkout(id)
    if (!src) return null
    let name = `${src.name} (cópia)`
    let n = 2
    while (workoutsOf(src.modalityId).some((w) => w.name === name)) name = `${src.name} (cópia ${n++})`
    return saveWorkout({
      modalityId: src.modalityId,
      name,
      description: src.description,
      notes: src.notes,
      goal: src.goal,
      active: src.active,
      exercises: src.exercises.map((e) => ({ ...e, id: uid() }))
    })
  }

  async function moveWorkout(id: string, dir: -1 | 1) {
    const w = getWorkout(id)
    if (!w) return
    const list = workoutsOf(w.modalityId)
    const i = list.findIndex((x) => x.id === id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i]
    const b = list[j]
    const updated = [
      { ...a, position: b.position },
      { ...b, position: a.position }
    ]
    await db.workouts.bulkPut(plain(updated))
    for (const u of updated) workouts.value[workouts.value.findIndex((x) => x.id === u.id)] = u
  }

  async function setWorkoutActive(id: string, active: boolean) {
    const w = getWorkout(id)
    if (w) await saveWorkout({ ...w, active })
  }

  async function deleteWorkout(id: string) {
    await db.workouts.delete(id)
    workouts.value = workouts.value.filter((w) => w.id !== id)
  }

  return {
    modalities, workouts, error, sortedModalities, activeModalities,
    load, getModality, getWorkout, workoutsOf,
    saveModality, moveModality, deleteModality,
    saveWorkout, duplicateWorkout, moveWorkout, setWorkoutActive, deleteWorkout
  }
})
