<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download, Sparkles, Trash2, Upload } from 'lucide-vue-next'
import { usePrefsStore, type Theme } from '@/stores/prefs'
import { exportAll, replaceAll, wipeAll } from '@/db'
import { backupSummary, BackupError, parseBackup } from '@/services/backup'
import { loadAll } from '@/composables/useBootstrap'
import { getDemoIds, loadDemoData, removeDemoData } from '@/composables/useDemo'
import { confirmDialog } from '@/composables/useConfirm'
import { toast, toastError } from '@/composables/useToast'
import { toDateKey } from '@/utils/date'

const prefs = usePrefsStore()
const fileInput = ref<HTMLInputElement | null>(null)
const hasDemo = ref(false)
const busy = ref(false)

async function refreshDemo() {
  hasDemo.value = !!(await getDemoIds())?.modalityIds.length
}
onMounted(refreshDemo)

async function doExport() {
  try {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `treinos-taf-backup-${toDateKey()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('Backup exportado.')
  } catch (e) {
    toastError(e, 'Não foi possível exportar.')
  }
}

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  try {
    const backup = parseBackup(await file.text())
    const ok = await confirmDialog({
      title: 'Substituir TODOS os dados?',
      message: `O backup contém: ${backupSummary(backup)}.\n\nTudo o que existe hoje neste aparelho será substituído. Exporte um backup antes se tiver dúvida.`,
      confirmText: 'Substituir e restaurar',
      danger: true
    })
    if (!ok) return
    await replaceAll(backup)
    await loadAll()
    await refreshDemo()
    toast('Backup restaurado.')
  } catch (e) {
    if (e instanceof BackupError) toastError(e)
    else toastError(e, 'Falha ao importar o backup. Nada foi alterado.')
  } finally {
    busy.value = false
  }
}

async function demo() {
  try {
    await loadDemoData()
    await refreshDemo()
    toast('Exemplo carregado.')
  } catch (e) {
    toastError(e)
  }
}
async function removeDemo() {
  if (!(await confirmDialog({ title: 'Remover o exemplo?', message: 'Apaga somente as modalidades, treinos e registros criados pelo exemplo. O que você cadastrou por conta própria não é tocado.', confirmText: 'Remover exemplo', danger: true }))) return
  try {
    await removeDemoData()
    await refreshDemo()
    toast('Exemplo removido.')
  } catch (e) {
    toastError(e)
  }
}
async function wipe() {
  if (!(await confirmDialog({ title: 'Apagar todos os dados?', message: 'Remove modalidades, treinos, planejamento, histórico e avaliações deste aparelho. Não há como desfazer — exporte um backup antes.', confirmText: 'Apagar tudo', danger: true }))) return
  if (!(await confirmDialog({ title: 'Tem certeza?', message: 'Esta é a última confirmação.', confirmText: 'Sim, apagar', danger: true }))) return
  try {
    await wipeAll()
    await loadAll()
    await refreshDemo()
    toast('Dados apagados.', 'info')
  } catch (e) {
    toastError(e)
  }
}

const themes: Array<[Theme, string]> = [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']]
</script>

<template>
  <div class="space-y-5">
    <h1 class="h-page">Configurações</h1>

    <section class="card space-y-4">
      <h2 class="font-bold">Aparência</h2>
      <div class="grid grid-cols-3 gap-2" role="group" aria-label="Tema">
        <button v-for="[k, l] in themes" :key="k" class="btn-soft" :class="prefs.theme === k ? 'ring-2 ring-brand-500' : ''" :aria-pressed="prefs.theme === k" @click="prefs.theme = k">{{ l }}</button>
      </div>
    </section>

    <section class="card space-y-4">
      <h2 class="font-bold">Cronômetro de descanso</h2>
      <div>
        <label class="label" for="rest">Descanso padrão (segundos)</label>
        <input id="rest" v-model.number="prefs.defaultRestSec" type="number" inputmode="numeric" min="5" max="1800" class="input" />
      </div>
      <label class="flex min-h-[44px] items-center gap-3 text-sm font-medium"><input v-model="prefs.autoRest" type="checkbox" class="h-5 w-5 rounded accent-brand-600" /> Iniciar o descanso ao concluir uma série</label>
      <label class="flex min-h-[44px] items-center gap-3 text-sm font-medium"><input v-model="prefs.sound" type="checkbox" class="h-5 w-5 rounded accent-brand-600" /> Alerta sonoro ao terminar</label>
      <label class="flex min-h-[44px] items-center gap-3 text-sm font-medium"><input v-model="prefs.vibrate" type="checkbox" class="h-5 w-5 rounded accent-brand-600" /> Vibrar ao terminar (quando o aparelho permitir)</label>
      <p class="muted">Navegadores podem pausar abas em segundo plano: o tempo continua correto (calculado pelo relógio) e, ao voltar, o app avisa se o descanso já terminou.</p>
    </section>

    <section class="card space-y-3">
      <h2 class="font-bold">Backup</h2>
      <p class="muted">Seus dados ficam só neste aparelho. Exporte um backup JSON de tempos em tempos, principalmente antes de trocar de celular ou limpar dados do navegador.</p>
      <div class="grid grid-cols-2 gap-2">
        <button class="btn-primary" @click="doExport"><Download :size="18" /> Exportar</button>
        <button class="btn-soft" :disabled="busy" @click="fileInput?.click()"><Upload :size="18" /> Importar</button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onFile" />
    </section>

    <section class="card space-y-3">
      <h2 class="font-bold">Dados de exemplo</h2>
      <p class="muted">Carrega modalidades, treinos e um planejamento de demonstração (sem cargas). Tudo é editável e pode ser removido sem afetar o que é seu.</p>
      <button v-if="!hasDemo" class="btn-soft" @click="demo"><Sparkles :size="16" /> Carregar exemplo</button>
      <button v-else class="btn-danger-soft" @click="removeDemo"><Trash2 :size="16" /> Remover exemplo</button>
    </section>

    <section class="card space-y-3">
      <h2 class="font-bold">Instalar no celular</h2>
      <ul class="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
        <li><strong>Android (Chrome):</strong> menu ⋮ → “Instalar app” / “Adicionar à tela inicial”.</li>
        <li><strong>iPhone (Safari):</strong> Compartilhar → “Adicionar à Tela de Início”.</li>
        <li>Depois do primeiro carregamento o app funciona offline.</li>
      </ul>
    </section>

    <section class="card space-y-3 border-red-200 dark:border-red-900/60">
      <h2 class="font-bold text-red-700 dark:text-red-300">Zona de risco</h2>
      <button class="btn-danger-soft" @click="wipe"><Trash2 :size="16" /> Apagar todos os dados</button>
    </section>

    <p class="muted pb-4 text-center">Treinos TAF · v1.1.0</p>
  </div>
</template>
