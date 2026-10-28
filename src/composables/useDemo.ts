import { db } from '@/db'
import { buildDemo } from '@/services/demo'
import { useModalitiesStore } from '@/stores/modalities'
import { loadAll } from './useBootstrap'

interface DemoIds {
  modalityIds: string[]
  /** dias da semana cujo planejamento foi preenchido pelo exemplo (estavam vazios) */
  planDays: number[]
  restDays: number[]
}

const KEY = 'demoIds'

export async function getDemoIds(): Promise<DemoIds | null> {
  const row = await db.settings.get(KEY)
  return (row?.value as DemoIds | undefined) ?? null
}

/** Carrega os dados de exemplo (opcionais). Não mexe em nada que você já tenha cadastrado. */
export async function loadDemoData(): Promise<void> {
  const existing = await getDemoIds()
  if (existing && existing.modalityIds.length) return
  const bundle = buildDemo(useModalitiesStore().modalities)
  const current = await db.weekPlan.toArray()
  const isEmptyDay = (wd: number) => {
    const r = current.find((c) => c.weekday === wd)
    return !r || (!r.rest && r.modalityIds.length === 0)
  }
  const planDays: number[] = []
  const restDays: number[] = []
  await db.transaction('rw', [db.modalities, db.workouts, db.weekPlan, db.settings], async () => {
    await db.modalities.bulkPut(bundle.modalities)
    await db.workouts.bulkPut(bundle.workouts)
    for (const d of bundle.weekPlan) {
      if (!isEmptyDay(d.weekday)) continue
      await db.weekPlan.put(d)
      planDays.push(d.weekday)
      if (d.rest) restDays.push(d.weekday)
    }
    await db.settings.put({ key: KEY, value: { modalityIds: bundle.modalities.map((m) => m.id), planDays, restDays } satisfies DemoIds })
  })
  await loadAll()
}

/** Remove SOMENTE o que o exemplo criou (modalidades, treinos, sessões dessas modalidades e o plano dos dias que ele preencheu). */
export async function removeDemoData(): Promise<void> {
  const ids = await getDemoIds()
  if (!ids) return
  await db.transaction('rw', [db.modalities, db.workouts, db.weekPlan, db.sessions, db.settings], async () => {
    await db.modalities.bulkDelete(ids.modalityIds)
    await db.workouts.where('modalityId').anyOf(ids.modalityIds).delete()
    await db.sessions.where('modalityId').anyOf(ids.modalityIds).delete()
    for (const row of await db.weekPlan.toArray()) {
      const kept = row.modalityIds.filter((m) => !ids.modalityIds.includes(m))
      const rest = ids.restDays.includes(row.weekday) ? false : row.rest
      if (kept.length !== row.modalityIds.length || rest !== row.rest) await db.weekPlan.put({ ...row, modalityIds: kept, rest })
    }
    await db.settings.delete(KEY)
  })
  await loadAll()
}
