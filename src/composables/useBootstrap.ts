import { useModalitiesStore } from '@/stores/modalities'
import { usePlanStore } from '@/stores/plan'
import { usePrefsStore } from '@/stores/prefs'
import { useSessionsStore } from '@/stores/sessions'
import { useTafStore } from '@/stores/taf'
import { ensureHomeModality } from '@/db/seed'

/** Carrega (ou recarrega, após importar backup) todos os stores a partir do IndexedDB. */
export async function loadAll() {
  try {
    await ensureHomeModality()
  } catch (e) {
    console.error('Não foi possível criar a modalidade Treino em Casa', e)
  }
  await Promise.all([
    useModalitiesStore().load(),
    usePlanStore().load(),
    useSessionsStore().load(),
    useTafStore().load(),
    usePrefsStore().load()
  ])
}

/** Pede ao navegador que não apague os dados locais por falta de espaço (melhor esforço). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* sem suporte: segue normalmente */
  }
}
