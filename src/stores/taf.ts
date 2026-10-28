import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import type { TafEvalKind, TafEvaluation, TafTest } from '@/types'
import { uid } from '@/utils/id'
import { SUGGESTED_TESTS } from '@/services/taf'
import { ValidationError } from './modalities'

export const useTafStore = defineStore('taf', () => {
  const tests = ref<TafTest[]>([])
  const evaluations = ref<TafEvaluation[]>([])
  const error = ref<string | null>(null)

  async function load() {
    try {
      tests.value = (await db.tafTests.toArray()).sort((a, b) => a.order - b.order)
      evaluations.value = await db.tafEvaluations.toArray()
    } catch (e) {
      error.value = 'Não foi possível carregar o TAF.'
      console.error(e)
    }
  }

  const getTest = (id: string) => tests.value.find((t) => t.id === id)

  async function saveTest(input: Partial<TafTest> & { name: string; unit: string }): Promise<TafTest> {
    const name = input.name.trim()
    if (!name) throw new ValidationError('Informe o nome da prova.')
    if (!input.unit.trim()) throw new ValidationError('Informe a unidade.')
    const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
    const ex = input.id ? getTest(input.id) : undefined
    const t: TafTest = {
      id: ex?.id ?? uid(),
      name,
      unit: input.unit.trim(),
      kind: input.kind ?? ex?.kind ?? 'custom',
      direction: input.direction ?? ex?.direction ?? 'higher',
      durationSec: num(input.durationSec),
      protocol: input.protocol ?? ex?.protocol ?? '',
      personalGoal: num(input.personalGoal),
      officialRef: num(input.officialRef),
      officialSource: input.officialSource ?? ex?.officialSource ?? '',
      active: input.active ?? ex?.active ?? true,
      order: ex?.order ?? (tests.value.length ? Math.max(...tests.value.map((x) => x.order)) + 1 : 0)
    }
    await db.tafTests.put(t)
    const i = tests.value.findIndex((x) => x.id === t.id)
    if (i >= 0) tests.value[i] = t
    else tests.value.push(t)
    return t
  }

  async function addSuggested() {
    for (const s of SUGGESTED_TESTS) {
      if (!tests.value.some((t) => t.name.toLowerCase() === s.name.toLowerCase())) await saveTest(s)
    }
  }

  async function deleteTest(id: string) {
    await db.transaction('rw', db.tafTests, db.tafEvaluations, async () => {
      await db.tafTests.delete(id)
      await db.tafEvaluations.where('testId').equals(id).delete()
    })
    tests.value = tests.value.filter((t) => t.id !== id)
    evaluations.value = evaluations.value.filter((e) => e.testId !== id)
  }

  async function saveEvaluation(input: {
    id?: string; testId: string; date: string; result: number; kind: TafEvalKind; durationSec?: number | null; notes?: string
    personalGoal?: number | null; officialRef?: number | null; officialSource?: string
  }): Promise<TafEvaluation> {
    const test = getTest(input.testId)
    if (!test) throw new ValidationError('Prova inválida.')
    if (!input.date) throw new ValidationError('Informe a data.')
    if (!Number.isFinite(input.result) || input.result < 0) throw new ValidationError('Resultado inválido.')
    const ex = input.id ? evaluations.value.find((e) => e.id === input.id) : undefined
    const ev: TafEvaluation = {
      id: ex?.id ?? uid(),
      testId: test.id,
      date: input.date,
      result: input.result,
      unit: test.unit,
      kind: input.kind,
      durationSec: input.durationSec ?? test.durationSec,
      notes: input.notes ?? '',
      // snapshot da meta e da referência vigentes na data do registro
      personalGoal: input.personalGoal !== undefined ? input.personalGoal : ex ? ex.personalGoal : test.personalGoal,
      officialRef: input.officialRef !== undefined ? input.officialRef : ex ? ex.officialRef : test.officialRef,
      officialSource: input.officialSource !== undefined ? input.officialSource : ex ? ex.officialSource : test.officialSource,
      createdAt: ex?.createdAt ?? Date.now()
    }
    await db.tafEvaluations.put(ev)
    const i = evaluations.value.findIndex((x) => x.id === ev.id)
    if (i >= 0) evaluations.value[i] = ev
    else evaluations.value.push(ev)
    return ev
  }

  async function deleteEvaluation(id: string) {
    await db.tafEvaluations.delete(id)
    evaluations.value = evaluations.value.filter((e) => e.id !== id)
  }

  return { tests, evaluations, error, load, getTest, saveTest, addSuggested, deleteTest, saveEvaluation, deleteEvaluation }
})
