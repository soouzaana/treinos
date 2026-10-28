import { describe, it, expect } from 'vitest'
import { compareSessions, exerciseHistory, exerciseKey, summarizeSets, compareLastTwo } from '@/services/progression'
import { completeSession, createSession } from '@/services/sessions'
import { mod, seq } from './helpers'
import type { Session, SetLog } from '@/types'

const sets = (arr: Array<[number, number]>): SetLog[] => arr.map(([load, reps], i) => ({ n: i + 1, load, reps, done: true, notes: '' }))
const sum = (arr: Array<[number, number]>) => ({ ...summarizeSets(sets(arr))!, date: 'd', sessionId: 's', completedAt: 1, unit: 'kg' })

describe('progressão de carga', () => {
  it('aumento de carga = evolução', () => {
    expect(compareSessions(sum([[20, 10], [20, 10]]), sum([[25, 8], [25, 8]])).evolution).toBe('evolucao')
  })
  it('mesma carga com mais repetições = evolução', () => {
    expect(compareSessions(sum([[20, 8]]), sum([[20, 10]])).evolution).toBe('evolucao')
  })
  it('mais séries com desempenho comparável = evolução', () => {
    expect(compareSessions(sum([[20, 10], [20, 10]]), sum([[20, 10], [20, 10], [20, 10]])).evolution).toBe('evolucao')
  })
  it('série adicional com redução relevante de carga NÃO é evolução automática', () => {
    const r = compareSessions(sum([[40, 10], [40, 10]]), sum([[40, 10], [40, 10], [10, 10], [10, 10], [10, 10]]))
    expect(r.evolution).toBe('manutencao')
  })
  it('queda de carga = regressão', () => {
    expect(compareSessions(sum([[30, 10]]), sum([[25, 10]])).evolution).toBe('regressao')
  })
  it('mesma carga com menos repetições = regressão', () => {
    expect(compareSessions(sum([[30, 10]]), sum([[30, 7]])).evolution).toBe('regressao')
  })
  it('igual = manutenção', () => {
    expect(compareSessions(sum([[30, 10]]), sum([[30, 10]])).evolution).toBe('manutencao')
  })
  it('séries não concluídas não contam', () => {
    const s = summarizeSets([{ n: 1, load: 50, reps: 10, done: false, notes: '' }, { n: 2, load: 20, reps: 10, done: true, notes: '' }])
    expect(s?.maxLoad).toBe(20)
    expect(s?.doneSets).toBe(1)
  })
})

describe('histórico por exercício', () => {
  const m = mod('musc')
  const w = seq('musc', ['Upper A', 'Upper B'])
  function sess(id: string, date: string, wk: number, arr: Array<[number, number]>, completed = true): Session {
    const s = createSession({ date, modality: m, workout: w[wk], suggestedWorkoutId: null, now: 1000 })
    const withSets = { ...s, id, exercises: [{ ...s.exercises[0], name: 'Agachamento Livre', sets: sets(arr) }] }
    return completed ? completeSession(withSets, 2000) : withSets
  }

  it('agrupa o mesmo exercício entre treinos diferentes (nome normalizado) e ignora não concluídas', () => {
    const list = [sess('a', '2026-10-01', 0, [[20, 10]]), sess('b', '2026-10-05', 1, [[25, 10]]), sess('c', '2026-10-09', 0, [[99, 10]], false)]
    const h = exerciseHistory(list, exerciseKey('agachamento  LIVRE'))
    expect(h.map((x) => x.maxLoad)).toEqual([20, 25])
    expect(compareLastTwo(h)?.evolution).toBe('evolucao')
  })

  it('compareLastTwo exige ao menos 2 sessões', () => {
    expect(compareLastTwo([])).toBeNull()
  })
})
