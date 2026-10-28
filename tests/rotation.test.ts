import { describe, it, expect } from 'vitest'
import { suggestWorkout, nextAfter, wouldRepeatLast } from '@/services/rotation'
import { completeSession, createSession, reopenSession, skipSession, switchWorkout } from '@/services/sessions'
import { mod, seq, done } from './helpers'

const musc = mod('musc')
const corr = mod('corr', 'Corrida', 'simple')
const mw = seq('musc', ['Upper A', 'Upper B', 'Lower A', 'Lower B', 'Lower C'])
const cw = seq('corr', ['Treino 1', 'Treino 2', 'Treino 3'])
const all = [...mw, ...cw]

describe('rotação por modalidade', () => {
  it('sem histórico sugere o primeiro treino ativo', () => {
    expect(suggestWorkout(all, [], 'musc')?.name).toBe('Upper A')
    expect(suggestWorkout(all, [], 'corr')?.name).toBe('Treino 1')
  })

  it('avança na ordem e dá a volta no final', () => {
    const sessions = mw.map((w, i) => done(`2026-10-0${i + 1}`, musc, w))
    expect(suggestWorkout(all, sessions, 'musc')?.name).toBe('Upper A')
    expect(suggestWorkout(all, sessions.slice(0, 2), 'musc')?.name).toBe('Lower A')
  })

  it('cada modalidade avança de forma independente', () => {
    const sessions = [done('2026-10-01', musc, mw[0]), done('2026-10-01', corr, cw[0]), done('2026-10-02', musc, mw[1])]
    expect(suggestWorkout(all, sessions, 'musc')?.name).toBe('Lower A')
    expect(suggestWorkout(all, sessions, 'corr')?.name).toBe('Treino 2')
  })

  it('concluir só a musculação não avança a corrida (conclusão parcial)', () => {
    const sessions = [done('2026-10-06', musc, mw[0])]
    expect(suggestWorkout(all, sessions, 'musc')?.name).toBe('Upper B')
    expect(suggestWorkout(all, sessions, 'corr')?.name).toBe('Treino 1')
  })

  it('concluir só a corrida não avança a musculação', () => {
    const sessions = [done('2026-10-06', corr, cw[0])]
    expect(suggestWorkout(all, sessions, 'musc')?.name).toBe('Upper A')
    expect(suggestWorkout(all, sessions, 'corr')?.name).toBe('Treino 2')
  })

  it('faltar (skipped) não avança', () => {
    const s = skipSession(createSession({ date: '2026-10-06', modality: musc, workout: mw[0], suggestedWorkoutId: mw[0].id }))
    expect(suggestWorkout(all, [s], 'musc')?.name).toBe('Upper A')
  })

  it('treino iniciado e não concluído não avança', () => {
    const s = createSession({ date: '2026-10-06', modality: musc, workout: mw[0], suggestedWorkoutId: mw[0].id })
    expect(s.status).toBe('in_progress')
    expect(suggestWorkout(all, [s], 'musc')?.name).toBe('Upper A')
  })

  it('Barra T1 → próxima sugestão é T2, independentemente do dia da semana', () => {
    const barra = mod('barra')
    const bw = seq('barra', ['Treino 1', 'Treino 2'])
    const quarta = done('2026-10-07', barra, bw[0]) // quarta
    expect(suggestWorkout(bw, [quarta], 'barra')?.name).toBe('Treino 2')
    const sabado = done('2026-10-10', barra, bw[0]) // sábado
    expect(suggestWorkout(bw, [sabado], 'barra')?.name).toBe('Treino 2')
  })

  it('substituição: avança a partir do treino realmente executado', () => {
    // sugerido Upper A, mas executou Lower A → próximo é Lower B
    const s = done('2026-10-06', musc, mw[2], mw[0])
    expect(s.substituted).toBe(true)
    expect(suggestWorkout(all, [s], 'musc')?.name).toBe('Lower B')
  })

  it('ignora treinos desativados e continua a rotação', () => {
    const w = mw.map((x) => (x.name === 'Upper B' ? { ...x, active: false } : x))
    const s = done('2026-10-06', musc, mw[0])
    expect(suggestWorkout(w, [s], 'musc')?.name).toBe('Lower A')
  })

  it('treino executado excluído: continua pela posição guardada', () => {
    const s = done('2026-10-06', musc, mw[1]) // Upper B (pos 1)
    const sem = all.filter((w) => w.id !== mw[1].id)
    expect(suggestWorkout(sem, [s], 'musc')?.name).toBe('Lower A')
  })

  it('reordenar a sequência preserva o histórico e respeita a nova ordem', () => {
    const s = done('2026-10-06', musc, mw[0]) // Upper A
    const reord = mw.map((w) => ({ ...w, position: w.name === 'Upper B' ? 9 : w.name === 'Lower A' ? 1 : w.position }))
    expect(suggestWorkout(reord, [s], 'musc')?.name).toBe('Lower A')
  })
})

describe('correção do histórico', () => {
  it('reabrir uma sessão concluída por engano recalcula a sugestão', () => {
    const a = done('2026-10-05', musc, mw[0])
    const b = done('2026-10-06', musc, mw[1])
    expect(suggestWorkout(all, [a, b], 'musc')?.name).toBe('Lower A')
    const corrigida = reopenSession(b)
    expect(suggestWorkout(all, [a, corrigida], 'musc')?.name).toBe('Upper B')
  })

  it('trocar o treino executado de uma sessão antiga recalcula a rotação', () => {
    const a = done('2026-10-05', musc, mw[0])
    const trocada = switchWorkout(a, mw[3], musc) // Lower B
    expect(suggestWorkout(all, [trocada], 'musc')?.name).toBe('Lower C')
  })

  it('a ordem usa data + momento da conclusão (registro retroativo)', () => {
    const tarde = done('2026-10-08', musc, mw[1])
    const retro = done('2026-10-03', musc, mw[0]) // criada depois, mas de data anterior
    expect(suggestWorkout(all, [tarde, retro], 'musc')?.name).toBe('Lower A')
  })

  it('beforeDate sugere com base apenas no que veio antes', () => {
    const a = done('2026-10-05', musc, mw[0])
    const b = done('2026-10-06', musc, mw[1])
    expect(suggestWorkout(all, [a, b], 'musc', { beforeDate: '2026-10-06' })?.name).toBe('Upper B')
  })
})

describe('conclusão', () => {
  it('concluir duas vezes não duplica nem altera o registro', () => {
    const s = createSession({ date: '2026-10-06', modality: musc, workout: mw[0], suggestedWorkoutId: mw[0].id, now: 1000 })
    const c1 = completeSession(s, 5000)
    const c2 = completeSession(c1, 9000)
    expect(c2).toBe(c1)
    expect(c2.completedAt).toBe(5000)
    expect(c1.id).toBe('2026-10-06_musc')
  })

  it('wouldRepeatLast alerta para repetição do último concluído', () => {
    const a = done('2026-10-05', musc, mw[0])
    expect(wouldRepeatLast([a], 'musc', mw[0].id)).toBe(true)
    expect(wouldRepeatLast([a], 'musc', mw[1].id)).toBe(false)
  })

  it('nextAfter sem treinos ativos retorna null', () => {
    expect(nextAfter(mw.map((w) => ({ ...w, active: false })), null)).toBeNull()
  })
})
