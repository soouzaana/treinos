import { describe, it, expect } from 'vitest'
import { projectDays } from '@/services/projection'
import { currentStreak } from '@/services/stats'
import type { WeekPlanDay } from '@/types'
import { mod, seq, done } from './helpers'
import { buildDemo } from '@/services/demo'

const musc = mod('musc')
const corr = mod('corr', 'Corrida', 'simple')
const mw = seq('musc', ['Upper A', 'Upper B', 'Lower A'])
const cw = seq('corr', ['Treino 1', 'Treino 2'])
const all = [...mw, ...cw]
// 2026-10-26 é segunda-feira
const plan: WeekPlanDay[] = [
  { weekday: 0, rest: true, modalityIds: [] },
  { weekday: 1, rest: false, modalityIds: ['musc'] },
  { weekday: 2, rest: false, modalityIds: ['musc', 'corr'] },
  { weekday: 3, rest: false, modalityIds: ['musc'] },
  { weekday: 4, rest: false, modalityIds: ['corr'] },
  { weekday: 5, rest: false, modalityIds: [] },
  { weekday: 6, rest: false, modalityIds: [] }
]

describe('projeção semanal', () => {
  it('atribui treinos em sequência, sem fixar em dias da semana', () => {
    const p = projectDays('2026-10-26', 7, plan, [musc, corr], all, [])
    const names = p.flatMap((d) => d.items.map((i) => `${d.date.slice(8)}:${i.modalityId}:${i.workoutName}`))
    expect(names).toEqual([
      '26:musc:Upper A',
      '27:musc:Upper B',
      '27:corr:Treino 1',
      '28:musc:Lower A',
      '29:corr:Treino 2'
    ])
    expect(p[6].rest).toBe(true)
  })

  it('sessão concluída prevalece e a projeção continua a partir dela', () => {
    const s = [done('2026-10-26', musc, mw[1], mw[0])] // executou Upper B no lugar de Upper A
    const p = projectDays('2026-10-26', 3, plan, [musc, corr], all, s)
    expect(p[0].items[0]).toMatchObject({ state: 'completed', workoutName: 'Upper B' })
    expect(p[1].items[0].workoutName).toBe('Lower A')
  })

  it('falta registrada não avança a projeção', () => {
    const p = projectDays('2026-10-26', 2, plan, [musc, corr], all, [])
    expect(p[0].items[0].workoutName).toBe('Upper A')
  })
})

describe('sequência atual', () => {
  it('conta dias previstos concluídos consecutivos e quebra na falta', () => {
    const s = [done('2026-10-26', musc, mw[0]), done('2026-10-28', musc, mw[1])]
    // terça 27 era prevista e não foi feita → quebra
    expect(currentStreak('musc', '2026-10-28', plan, s)).toBe(1)
    const s2 = [...s, done('2026-10-27', musc, mw[2])]
    expect(currentStreak('musc', '2026-10-28', plan, s2)).toBe(3)
  })

  it('hoje pendente não quebra a sequência', () => {
    const s = [done('2026-10-26', musc, mw[0])]
    expect(currentStreak('musc', '2026-10-27', plan, s)).toBe(1)
  })
})

describe('dados de exemplo', () => {
  it('são opcionais, sem cargas fictícias e com ids consistentes', () => {
    const d = buildDemo([])
    expect(d.modalities).toHaveLength(5)
    const ids = new Set(d.modalities.map((m) => m.id))
    expect(d.workouts.every((w) => ids.has(w.modalityId))).toBe(true)
    expect(d.workouts.flatMap((w) => w.exercises).every((e) => e.load === null)).toBe(true)
  })
})
