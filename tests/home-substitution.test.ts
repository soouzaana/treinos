import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { db, exportAll, replaceAll, wipeAll } from '@/db'
import { ensureHomeModality, HOME_SEEDED_KEY } from '@/db/seed'
import { loadAll } from '@/composables/useBootstrap'
import { newExercise, useModalitiesStore } from '@/stores/modalities'
import { useSessionsStore } from '@/stores/sessions'
import { parseBackup } from '@/services/backup'
import { countCompleted, currentStreak, rangeStats } from '@/services/stats'
import { applySwaps, canSubstitute, findHomeModality } from '@/services/substitution'
import type { Modality, WeekPlanDay } from '@/types'

// 2026-10-20 = terça-feira (weekday 2)
const D1 = '2026-10-20'
const D2 = '2026-10-21'
const D3 = '2026-11-25' // semanas depois: a rotação não depende dos dias
const TODAY = '2026-12-31'

async function setup() {
  await wipeAll()
  setActivePinia(createPinia())
  await ensureHomeModality()
  const mods = useModalitiesStore()
  const sess = useSessionsStore()
  await mods.load()
  const musc = await mods.saveModality({ name: 'Musculação', category: 'musculacao' })
  for (const n of ['Upper A', 'Upper B', 'Lower A']) await mods.saveWorkout({ modalityId: musc.id, name: n, exercises: [newExercise({ name: 'Supino' })] })
  const corr = await mods.saveModality({ name: 'Corrida', category: 'cardio', logType: 'simple' })
  for (const n of ['Treino 1', 'Treino 2', 'Treino 3']) await mods.saveWorkout({ modalityId: corr.id, name: n, exercises: [newExercise({ name: 'Corrida contínua', unit: '' })] })
  const home = findHomeModality(mods.modalities)!
  await sess.load()
  return { mods, sess, musc, corr, home }
}

/** Simula fechar e reabrir o app: stores novos, tudo relido do IndexedDB. */
async function reload() {
  setActivePinia(createPinia())
  await loadAll()
  return { mods: useModalitiesStore(), sess: useSessionsStore() }
}

const plan = (ids: string[]): WeekPlanDay[] => [{ weekday: 2, rest: false, modalityIds: ids }]

describe('Treino em Casa — modalidade inicial', () => {
  it('cria a modalidade com 4 treinos vazios, uma única vez', async () => {
    await wipeAll()
    setActivePinia(createPinia())
    await ensureHomeModality()
    await ensureHomeModality()
    const mods = useModalitiesStore()
    await mods.load()
    const homes = mods.modalities.filter((m) => m.category === 'casa')
    expect(homes).toHaveLength(1)
    expect(homes[0].name).toBe('Treino em Casa')
    expect(mods.workoutsOf(homes[0].id).map((w) => w.name)).toEqual(['Treino em Casa 1', 'Treino em Casa 2', 'Treino em Casa 3', 'Treino em Casa 4'])
    expect(mods.workoutsOf(homes[0].id).every((w) => w.exercises.length === 0)).toBe(true) // nada inventado
  })

  it('não volta depois de excluída e não duplica uma "Treino em Casa" já existente', async () => {
    const { mods, home } = await setup()
    await mods.deleteModality(home.id)
    await ensureHomeModality()
    await mods.load()
    expect(mods.modalities.some((m) => m.category === 'casa')).toBe(false)

    await wipeAll()
    await db.modalities.put({ id: 'x', name: 'treino em casa', color: '#000', category: 'outro', logType: 'sets', order: 0, active: true, createdAt: 1 })
    await ensureHomeModality()
    expect((await db.modalities.toArray()).length).toBe(1)
    expect(await db.settings.get(HOME_SEEDED_KEY)).toBeTruthy()
  })

  it('acrescenta a modalidade em uma base existente sem tocar nos dados atuais', async () => {
    await wipeAll()
    await db.modalities.put({ id: 'm1', name: 'Musculação', color: '#111', category: 'musculacao', logType: 'sets', order: 0, active: true, createdAt: 1 })
    await db.workouts.put({ id: 'w1', modalityId: 'm1', name: 'Upper A', position: 0, description: 'x', notes: '', goal: '', active: true, exercises: [], createdAt: 1 })
    await ensureHomeModality()
    expect((await db.modalities.get('m1'))?.name).toBe('Musculação')
    expect((await db.workouts.get('w1'))?.description).toBe('x')
    const all = await db.modalities.toArray()
    expect(all).toHaveLength(2)
    expect(all.find((m) => m.category === 'casa')?.order).toBe(1)
  })
})

describe('1–2. Substituir a musculação e concluir o treino em casa', () => {
  it('avança só a sequência de Treino em Casa; a de musculação não avança', async () => {
    const { mods, sess, musc, home } = await setup()
    expect(sess.suggestionFor(musc.id, D1)?.name).toBe('Upper A')
    await sess.substitute(D1, musc, home)
    expect(sess.suggestionFor(home.id, D1)?.name).toBe('Treino em Casa 1')
    const done = await sess.complete(D1, home)
    expect(done?.status).toBe('completed')
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 2')
    expect(sess.nextFor(musc.id)?.name).toBe('Upper A') // musculação intacta
    expect(sess.sessions.filter((s) => s.modalityId === musc.id)).toHaveLength(0)
    expect(mods.getModality(done!.replacesModalityId!)?.name).toBe('Musculação')
    expect(done?.replacesWorkoutName).toBe('Upper A')
  })

  it('concluir a musculação normalmente avança só a musculação', async () => {
    const { sess, musc, home } = await setup()
    await sess.complete(D1, musc)
    expect(sess.nextFor(musc.id)?.name).toBe('Upper B')
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 1')
  })
})

describe('3–5. Dia musculação + corrida', () => {
  it('o dia vira Treino em Casa + corrida, na mesma ordem de apresentação', async () => {
    const { sess, musc, corr, home } = await setup()
    await sess.substitute(D1, musc, home)
    expect(applySwaps([musc.id, corr.id], sess.swapsOn(D1), D1)).toEqual([home.id, corr.id])
    // outro dia continua normal
    expect(applySwaps([musc.id, corr.id], sess.swapsOn(D2), D2)).toEqual([musc.id, corr.id])
  })

  it('concluir só o treino em casa: a corrida segue pendente com o treino sugerido', async () => {
    const { sess, musc, corr, home } = await setup()
    const before = sess.suggestionFor(corr.id, D1)?.name
    await sess.substitute(D1, musc, home)
    await sess.complete(D1, home)
    expect(sess.get(D1, corr.id)).toBeUndefined()
    expect(sess.suggestionFor(corr.id, D1)?.name).toBe(before)
    expect(sess.nextFor(corr.id)?.name).toBe('Treino 1')
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 2')
  })

  it('concluir treino em casa e corrida: as duas sequências avançam de forma independente', async () => {
    const { sess, musc, corr, home } = await setup()
    await sess.substitute(D1, musc, home)
    await sess.complete(D1, home)
    await sess.complete(D1, corr)
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 2')
    expect(sess.nextFor(corr.id)?.name).toBe('Treino 2')
    expect(sess.nextFor(musc.id)?.name).toBe('Upper A')
  })
})

describe('6. Treino em casa interrompido / cancelamento', () => {
  it('iniciar e não concluir não avança nenhuma sequência', async () => {
    const { sess, musc, corr, home } = await setup()
    await sess.substitute(D1, musc, home)
    const s = await sess.start(D1, home)
    expect(s?.status).toBe('in_progress')
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 1')
    expect(sess.nextFor(musc.id)?.name).toBe('Upper A')
    expect(sess.nextFor(corr.id)?.name).toBe('Treino 1')
  })

  it('cancelar antes de iniciar devolve a musculação originalmente sugerida', async () => {
    const { sess, musc, home } = await setup()
    await sess.substitute(D1, musc, home)
    expect(await sess.cancelSubstitution(D1, musc.id)).toBe('cancelled')
    expect(sess.swapsOn(D1)).toHaveLength(0)
    expect(applySwaps([musc.id], sess.swapsOn(D1), D1)).toEqual([musc.id])
    expect(sess.suggestionFor(musc.id, D1)?.name).toBe('Upper A')
  })

  it('depois de iniciado, o registro não é descartado sem ação explícita', async () => {
    const { sess, mods, musc, home } = await setup()
    await sess.substitute(D1, musc, home)
    const w = mods.workoutsOf(home.id)[0]
    await mods.saveWorkout({ ...w, modalityId: home.id, name: w.name, exercises: [newExercise({ name: 'Agachamento livre' })] })
    const s = (await sess.start(D1, home))!
    await sess.updateExercises(s.id, [{ exerciseId: 'e', name: 'Agachamento livre', unit: 'kg', plannedSets: 1, plannedReps: '10', plannedLoad: null, done: false, sets: [{ n: 1, load: 20, reps: 10, done: true, notes: '' }] }])

    expect(await sess.cancelSubstitution(D1, musc.id)).toBe('needs-confirm')
    expect(sess.get(D1, home.id)?.exercises[0].sets[0].reps).toBe(10) // dados preservados
    expect(sess.swapsOn(D1)).toHaveLength(1)

    expect(await sess.cancelSubstitution(D1, musc.id, true)).toBe('cancelled')
    expect(sess.get(D1, home.id)).toBeUndefined()
    expect(sess.swapsOn(D1)).toHaveLength(0)
  })

  it('"não treinei" no treino em casa não avança nada e pode ser desfeito sem pedir confirmação', async () => {
    const { sess, musc, home } = await setup()
    await sess.substitute(D1, musc, home)
    await sess.skip(D1, home)
    expect(sess.get(D1, home.id)?.status).toBe('skipped')
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 1')
    expect(await sess.cancelSubstitution(D1, musc.id)).toBe('cancelled')
  })

  it('não permite substituir quando a musculação já tem registro, nem substituir duas vezes', async () => {
    const { sess, musc, home } = await setup()
    await sess.start(D1, musc)
    await expect(sess.substitute(D1, musc, home)).rejects.toThrow()
    await sess.substitute(D2, musc, home)
    await expect(sess.substitute(D2, musc, home)).rejects.toThrow()
    expect(canSubstitute(musc, home, false, false)).toBe(true)
    expect(canSubstitute(musc, home, true, false)).toBe(false)
    expect(canSubstitute({ ...musc, category: 'cardio' } as Modality, home, false, false)).toBe(false)
  })
})

describe('7. Persistência e continuidade', () => {
  it('após recarregar, substituição, sessão e sequência continuam de onde pararam', async () => {
    const { sess, musc, home } = await setup()
    await sess.substitute(D1, musc, home)
    await sess.complete(D1, home)
    await sess.substitute(D2, musc, home)
    const { mods, sess: sess2 } = await reload()
    const home2 = findHomeModality(mods.modalities)!
    expect(home2.id).toBe(home.id)
    expect(mods.modalities.filter((m) => m.category === 'casa')).toHaveLength(1) // sem duplicar ao recarregar
    expect(sess2.swaps.map((s) => s.date).sort()).toEqual([D1, D2])
    expect(sess2.get(D1, home.id)?.status).toBe('completed')
    expect(sess2.nextFor(home.id)?.name).toBe('Treino em Casa 2')
    expect(sess2.suggestionFor(home.id, D2)?.name).toBe('Treino em Casa 2')
  })

  it('continua de onde parou mesmo depois de semanas', async () => {
    const { sess, musc, home } = await setup()
    await sess.substitute(D1, musc, home)
    await sess.complete(D1, home) // Casa 1
    await sess.substitute(D2, musc, home)
    await sess.complete(D2, home) // Casa 2
    await sess.substitute(D3, musc, home)
    expect(sess.suggestionFor(home.id, D3)?.name).toBe('Treino em Casa 3')
    expect(sess.suggestionFor(musc.id, D3)?.name).toBe('Upper A')
  })

  it('concluir duas vezes não duplica o registro', async () => {
    const { sess, musc, home } = await setup()
    await sess.substitute(D1, musc, home)
    const a = await sess.complete(D1, home)
    const b = await sess.complete(D1, home)
    expect(sess.sessions.filter((s) => s.modalityId === home.id)).toHaveLength(1)
    expect(b?.completedAt).toBe(a?.completedAt)
  })
})

describe('8. Corrigir um registro antigo recalcula as sugestões', () => {
  it('trocar o treino, reabrir e excluir recalculam sem apagar o restante do histórico', async () => {
    const { mods, sess, musc, home } = await setup()
    await sess.substitute(D1, musc, home)
    await sess.complete(D1, home) // Casa 1
    await sess.substitute(D2, musc, home)
    const s2 = (await sess.complete(D2, home))! // Casa 2
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 3')

    // foi na verdade o Treino em Casa 3
    await sess.changeWorkout(s2.id, mods.workoutsOf(home.id)[2], home)
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 4')

    await sess.reopen(s2.id)
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 2') // só Casa 1 vale
    expect(sess.get(D1, home.id)?.status).toBe('completed') // histórico preservado

    await sess.update({ ...sess.get(D2, home.id)!, status: 'completed', completedAt: Date.now() })
    await sess.removeSession(s2.id)
    expect(sess.nextFor(home.id)?.name).toBe('Treino em Casa 2')
    const { sess: again } = await reload()
    expect(again.nextFor(home.id)?.name).toBe('Treino em Casa 2')
  })
})

describe('9. Histórico e indicadores separam musculação de treino em casa', () => {
  it('Treino em Casa conta como modalidade própria; a musculação substituída não é "realizada" nem "faltou"', async () => {
    const { mods, sess, musc, corr, home } = await setup()
    const p = plan([musc.id, corr.id])
    await sess.substitute(D1, musc, home)
    await sess.complete(D1, home)

    const homeStats = rangeStats(D1, D1, TODAY, p, mods.modalities, sess.sessions, home.id, sess.swaps)
    const muscStats = rangeStats(D1, D1, TODAY, p, mods.modalities, sess.sessions, musc.id, sess.swaps)
    const all = rangeStats(D1, D1, TODAY, p, mods.modalities, sess.sessions, undefined, sess.swaps)
    expect(homeStats).toMatchObject({ planned: 1, completed: 1, notDone: 0, extra: 0 })
    expect(muscStats).toMatchObject({ planned: 0, completed: 0, notDone: 0 })
    expect(all).toMatchObject({ planned: 2, completed: 1, notDone: 1 }) // corrida pendente
    // sem considerar a substituição, a musculação apareceria como falta:
    expect(rangeStats(D1, D1, TODAY, p, mods.modalities, sess.sessions, musc.id)).toMatchObject({ planned: 1, notDone: 1 })

    expect(countCompleted(sess.sessions, home.id)).toBe(1)
    expect(countCompleted(sess.sessions, musc.id)).toBe(0)
    expect(currentStreak(home.id, D1, p, sess.sessions, 5, sess.swaps)).toBe(1)
    expect(currentStreak(musc.id, D1, p, sess.sessions, 5, sess.swaps)).toBe(0)
  })

  it('o registro guarda a substituição, o treino programado e é distinto de uma sessão de musculação', async () => {
    const { sess, musc, home } = await setup()
    await sess.complete(D1, musc)
    await sess.substitute(D2, musc, home)
    await sess.complete(D2, home)
    const m = sess.get(D1, musc.id)!
    const h = sess.get(D2, home.id)!
    expect(m.modalityId).toBe(musc.id)
    expect(m.replacesModalityId).toBeFalsy()
    expect(h.modalityId).toBe(home.id)
    expect(h.replacesModalityId).toBe(musc.id)
    expect(h.replacesWorkoutName).toBe('Upper B') // a musculação já tinha avançado para Upper B
  })
})

describe('10. Backup preserva a nova modalidade', () => {
  it('exportar → apagar → importar mantém modalidade, treinos, sessões e substituições', async () => {
    const { sess, musc, corr, home } = await setup()
    await sess.substitute(D1, musc, home)
    await sess.complete(D1, home)
    await sess.substitute(D2, musc, home)

    const json = JSON.stringify(await exportAll())
    const backup = parseBackup(json)
    expect(backup.data.modalities.some((m) => m.category === 'casa')).toBe(true)
    expect(backup.data.settings.some((s) => s.key === 'daySwaps')).toBe(true)

    await wipeAll()
    await replaceAll(backup)
    const { mods, sess: after } = await reload()
    const homes = mods.modalities.filter((m) => m.category === 'casa')
    expect(homes).toHaveLength(1) // sem duplicar após importar
    expect(homes[0].id).toBe(home.id)
    expect(mods.workoutsOf(home.id)).toHaveLength(4)
    expect(after.get(D1, home.id)).toMatchObject({ status: 'completed', replacesModalityId: musc.id, replacesWorkoutName: 'Upper A' })
    expect(after.swapsOn(D2)).toHaveLength(1)
    expect(after.nextFor(home.id)?.name).toBe('Treino em Casa 2')
    expect(after.nextFor(corr.id)?.name).toBe('Treino 1')
    expect(after.nextFor(musc.id)?.name).toBe('Upper A')
  })

  it('backup antigo (sem Treino em Casa) é restaurado e ganha a modalidade sem perder nada', async () => {
    const { sess, musc } = await setup()
    await sess.complete(D1, musc)
    const old = JSON.parse(JSON.stringify(await exportAll()))
    old.data.modalities = old.data.modalities.filter((m: Modality) => m.category !== 'casa')
    old.data.workouts = old.data.workouts.filter((w: { name: string }) => !w.name.startsWith('Treino em Casa'))
    old.data.settings = old.data.settings.filter((s: { key: string }) => s.key !== HOME_SEEDED_KEY && s.key !== 'daySwaps')
    for (const s of old.data.sessions) {
      delete s.replacesModalityId
      delete s.replacesWorkoutId
      delete s.replacesWorkoutName
    }
    await wipeAll()
    await replaceAll(parseBackup(JSON.stringify(old)))
    const { mods, sess: after } = await reload()
    expect(mods.modalities.filter((m) => m.category === 'casa')).toHaveLength(1)
    expect(after.get(D1, musc.id)?.status).toBe('completed')
    expect(after.nextFor(musc.id)?.name).toBe('Upper B')
  })
})
