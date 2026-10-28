import { describe, it, expect } from 'vitest'
import { paceMinPerKm, formatPace, percentOfGoal, personalStatus, officialStatus, compareWithPrevious, sortedEvals } from '@/services/taf'
import { startTimer, remainingMs, syncTimer, pauseTimer, resumeTimer, restartTimer, finishedAgoMs, formatClock, idleTimer } from '@/services/timer'
import { parseBackup, validateBackup, BackupError } from '@/services/backup'
import type { TafEvaluation, TafTest } from '@/types'

const test12: TafTest = { id: 't', name: 'Corrida 12', unit: 'm', kind: 'distance', direction: 'higher', durationSec: 720, protocol: '', personalGoal: 2400, officialRef: null, officialSource: '', active: true, order: 0 }
const ev = (id: string, date: string, result: number): TafEvaluation => ({ id, testId: 't', date, result, unit: 'm', kind: 'training', durationSec: 720, notes: '', personalGoal: null, officialRef: null, officialSource: '', createdAt: Number(id) })

describe('TAF', () => {
  it('calcula ritmo médio em min/km', () => {
    expect(paceMinPerKm(2400, 720)).toBeCloseTo(5, 5)
    expect(formatPace(5)).toBe('5:00 min/km')
    expect(paceMinPerKm(0, 720)).toBeNull()
  })
  it('percentual da meta (maior é melhor e menor é melhor)', () => {
    expect(percentOfGoal(test12, 1800, 2400)).toBeCloseTo(75)
    expect(percentOfGoal({ direction: 'lower' }, 15, 12)).toBeCloseTo(80)
    expect(percentOfGoal(test12, 100, null)).toBeNull()
  })
  it('situação: atingida / em progresso / abaixo / sem meta', () => {
    expect(personalStatus(test12, [ev('1', '2026-10-01', 2000), ev('2', '2026-10-10', 2450)])).toBe('achieved')
    expect(personalStatus(test12, [ev('1', '2026-10-01', 2000), ev('2', '2026-10-10', 2100)])).toBe('progress')
    expect(personalStatus(test12, [ev('1', '2026-10-01', 2100), ev('2', '2026-10-10', 2000)])).toBe('below')
    expect(personalStatus(test12, [ev('1', '2026-10-01', 2000)])).toBe('below')
    expect(personalStatus({ ...test12, personalGoal: null }, [ev('1', '2026-10-01', 2000)])).toBe('nogoal')
  })
  it('referência oficial é independente da meta pessoal e só existe se cadastrada', () => {
    const list = [ev('1', '2026-10-01', 2450)]
    expect(officialStatus(test12, list)).toBe('none')
    expect(officialStatus({ ...test12, officialRef: 2500 }, list)).toBe('not_meets')
    expect(officialStatus({ ...test12, officialRef: 2400 }, list)).toBe('meets')
  })
  it('compara com a avaliação anterior e ordena por data', () => {
    const list = sortedEvals([ev('2', '2026-10-10', 2100), ev('1', '2026-10-01', 2000)], 't')
    const c = compareWithPrevious(test12, list)
    expect(c?.delta).toBe(100)
    expect(c?.improved).toBe(true)
  })
})

describe('cronômetro por timestamp', () => {
  it('calcula o restante a partir do relógio, sem depender de ticks', () => {
    const t = startTimer(60000, 1_000)
    expect(remainingMs(t, 1_000)).toBe(60000)
    expect(remainingMs(t, 31_000)).toBe(30000) // "aba em segundo plano" por 30 s
    expect(remainingMs(t, 999_999)).toBe(0)
  })
  it('termina em segundo plano e informa há quanto tempo', () => {
    const t = syncTimer(startTimer(30000, 0), 100_000)
    expect(t.status).toBe('finished')
    expect(finishedAgoMs(t, 100_000)).toBe(70000)
  })
  it('pausa congela e retoma continua do ponto certo', () => {
    let t = startTimer(60000, 0)
    t = pauseTimer(t, 20000)
    expect(t.status).toBe('paused')
    expect(remainingMs(t, 500000)).toBe(40000)
    t = resumeTimer(t, 500000)
    expect(remainingMs(t, 510000)).toBe(30000)
  })
  it('reiniciar usa a mesma duração; formatClock arredonda para cima', () => {
    const t = restartTimer(startTimer(90000, 0), 200000)
    expect(t.durationMs).toBe(90000)
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(90000)).toBe('01:30')
    expect(idleTimer().status).toBe('idle')
  })
})

describe('validação de backup', () => {
  const base = { app: 'treinos-taf', schemaVersion: 1, exportedAt: new Date().toISOString(), data: { modalities: [], workouts: [], weekPlan: [], sessions: [], tafTests: [], tafEvaluations: [], settings: [] } }
  it('aceita backup válido', () => {
    expect(validateBackup(base).schemaVersion).toBe(1)
    expect(parseBackup(JSON.stringify(base)).app).toBe('treinos-taf')
  })
  it('rejeita arquivos inválidos', () => {
    expect(() => parseBackup('{oops')).toThrow(BackupError)
    expect(() => validateBackup({ ...base, app: 'outro' })).toThrow(BackupError)
    expect(() => validateBackup({ ...base, data: { ...base.data, sessions: undefined } })).toThrow(BackupError)
    expect(() => validateBackup({ ...base, schemaVersion: 99 })).toThrow(BackupError)
    expect(() => validateBackup({ ...base, data: { ...base.data, modalities: [{ name: 'sem id' }] } })).toThrow(BackupError)
  })
})
