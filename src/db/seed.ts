import { db } from '@/db'
import type { Modality, Workout } from '@/types'
import { uid } from '@/utils/id'
import { findHomeModality, HOME_NAME, HOME_WORKOUT_COUNT } from '@/services/substitution'

export const HOME_SEEDED_KEY = 'homeSeeded'
export const HOME_COLOR = '#8b5cf6'

/**
 * Garante a modalidade "Treino em Casa" (4 treinos vazios, para você preencher) UMA vez por base de dados.
 * - Base existente: acrescenta a modalidade sem tocar em nada do que já foi cadastrado.
 * - Se você excluir a modalidade depois, ela não volta (a marca fica em settings['homeSeeded']).
 * - Se já existir uma "Treino em Casa" (por categoria ou nome), apenas registra a marca.
 * Nenhum exercício é inventado. Sem mudança de esquema do IndexedDB, logo sem migração de versão.
 */
export async function ensureHomeModality(): Promise<void> {
  if (await db.settings.get(HOME_SEEDED_KEY)) return
  await db.transaction('rw', [db.modalities, db.workouts, db.settings], async () => {
    if (await db.settings.get(HOME_SEEDED_KEY)) return
    const existing = await db.modalities.toArray()
    if (!findHomeModality(existing, false)) {
      const now = Date.now()
      const home: Modality = {
        id: uid(),
        name: HOME_NAME,
        color: HOME_COLOR,
        category: 'casa',
        logType: 'sets',
        order: existing.length ? Math.max(...existing.map((m) => m.order)) + 1 : 0,
        active: true,
        createdAt: now
      }
      await db.modalities.put(home)
      const workouts: Workout[] = Array.from({ length: HOME_WORKOUT_COUNT }, (_, i) => ({
        id: uid(),
        modalityId: home.id,
        name: `${HOME_NAME} ${i + 1}`,
        position: i,
        description: '',
        notes: '',
        goal: '',
        active: true,
        exercises: [],
        createdAt: now
      }))
      await db.workouts.bulkPut(workouts)
    }
    await db.settings.put({ key: HOME_SEEDED_KEY, value: true })
  })
}
