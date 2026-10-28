import type { BackupFile } from '@/types'

export const BACKUP_SCHEMA_VERSION = 1

export class BackupError extends Error {}

const TABLES = ['modalities', 'workouts', 'weekPlan', 'sessions', 'tafTests', 'tafEvaluations', 'settings'] as const

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Valida a estrutura de um backup (lança BackupError descrevendo o problema). */
export function validateBackup(raw: unknown): BackupFile {
  if (!isObj(raw)) throw new BackupError('Arquivo inválido: não é um objeto JSON.')
  if (raw.app !== 'treinos-taf') throw new BackupError('Este arquivo não é um backup do Treinos TAF.')
  if (typeof raw.schemaVersion !== 'number') throw new BackupError('Backup sem versão de esquema.')
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) throw new BackupError('Backup criado por uma versão mais nova do app.')
  if (!isObj(raw.data)) throw new BackupError('Backup sem bloco "data".')
  const data = raw.data
  for (const t of TABLES) {
    if (!Array.isArray(data[t])) throw new BackupError(`Backup inválido: tabela "${t}" ausente.`)
  }
  const needId = ['modalities', 'workouts', 'sessions', 'tafTests', 'tafEvaluations'] as const
  for (const t of needId) {
    for (const row of data[t] as unknown[]) {
      if (!isObj(row) || typeof row.id !== 'string') throw new BackupError(`Backup inválido: registro sem id em "${t}".`)
    }
  }
  for (const w of data.workouts as Array<Record<string, unknown>>) {
    if (typeof w.modalityId !== 'string' || !Array.isArray(w.exercises)) throw new BackupError('Backup inválido: treino malformado.')
  }
  for (const s of data.sessions as Array<Record<string, unknown>>) {
    if (typeof s.date !== 'string' || typeof s.modalityId !== 'string' || !['in_progress', 'completed', 'skipped'].includes(String(s.status)))
      throw new BackupError('Backup inválido: sessão malformada.')
  }
  for (const p of data.weekPlan as Array<Record<string, unknown>>) {
    if (typeof p.weekday !== 'number' || !Array.isArray(p.modalityIds)) throw new BackupError('Backup inválido: planejamento malformado.')
  }
  for (const s of data.settings as Array<Record<string, unknown>>) {
    if (typeof s.key !== 'string') throw new BackupError('Backup inválido: configuração malformada.')
  }
  return raw as unknown as BackupFile
}

export function parseBackup(text: string): BackupFile {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupError('Arquivo não é um JSON válido.')
  }
  return validateBackup(json)
}

export function backupSummary(b: BackupFile): string {
  const d = b.data
  return `${d.modalities.length} modalidades, ${d.workouts.length} treinos, ${d.sessions.length} sessões, ${d.tafEvaluations.length} avaliações do TAF (exportado em ${new Date(b.exportedAt).toLocaleString('pt-BR')})`
}
