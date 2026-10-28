import Dexie, { type Table } from 'dexie'
import type { Modality, Session, SettingRow, TafEvaluation, TafTest, WeekPlanDay, Workout, BackupFile } from '@/types'
import { BACKUP_SCHEMA_VERSION } from '@/services/backup'

export class TreinosDB extends Dexie {
  modalities!: Table<Modality, string>
  workouts!: Table<Workout, string>
  weekPlan!: Table<WeekPlanDay, number>
  sessions!: Table<Session, string>
  tafTests!: Table<TafTest, string>
  tafEvaluations!: Table<TafEvaluation, string>
  settings!: Table<SettingRow, string>

  constructor(name = 'treinos-taf') {
    super(name)
    // Versão 1. Para evoluir o esquema, adicione this.version(2).stores({...}).upgrade(...)
    // sem remover as versões anteriores: o Dexie migra os dados do usuário automaticamente.
    this.version(1).stores({
      modalities: 'id, order',
      workouts: 'id, modalityId, position',
      weekPlan: 'weekday',
      sessions: 'id, date, modalityId, status, [modalityId+status]',
      tafTests: 'id, order',
      tafEvaluations: 'id, testId, date',
      settings: 'key'
    })
  }
}

export const db = new TreinosDB()

export async function exportAll(): Promise<BackupFile> {
  const [modalities, workouts, weekPlan, sessions, tafTests, tafEvaluations, settings] = await Promise.all([
    db.modalities.toArray(),
    db.workouts.toArray(),
    db.weekPlan.toArray(),
    db.sessions.toArray(),
    db.tafTests.toArray(),
    db.tafEvaluations.toArray(),
    db.settings.toArray()
  ])
  return {
    app: 'treinos-taf',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { modalities, workouts, weekPlan, sessions, tafTests, tafEvaluations, settings }
  }
}

const ALL_TABLES = () => [db.modalities, db.workouts, db.weekPlan, db.sessions, db.tafTests, db.tafEvaluations, db.settings]

/** Substitui TODOS os dados por um backup já validado (transação única: ou tudo, ou nada). */
export async function replaceAll(b: BackupFile): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    await Promise.all(ALL_TABLES().map((t) => t.clear()))
    await db.modalities.bulkPut(b.data.modalities)
    await db.workouts.bulkPut(b.data.workouts)
    await db.weekPlan.bulkPut(b.data.weekPlan)
    await db.sessions.bulkPut(b.data.sessions)
    await db.tafTests.bulkPut(b.data.tafTests)
    await db.tafEvaluations.bulkPut(b.data.tafEvaluations)
    await db.settings.bulkPut(b.data.settings)
  })
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    await Promise.all(ALL_TABLES().map((t) => t.clear()))
  })
}
