<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowDown, ArrowUp, ChevronRight, Dumbbell, Pencil, Plus, Sparkles, Trash2 } from 'lucide-vue-next'
import { CATEGORY_LABEL, useModalitiesStore } from '@/stores/modalities'
import { usePlanStore } from '@/stores/plan'
import { useSessionsStore } from '@/stores/sessions'
import type { Modality } from '@/types'
import ModalityForm from '@/components/ModalityForm.vue'
import EmptyState from '@/components/EmptyState.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { toast, toastError } from '@/composables/useToast'
import { loadDemoData } from '@/composables/useDemo'

const mods = useModalitiesStore()
const plan = usePlanStore()
const sessions = useSessionsStore()

const formOpen = ref(false)
const editing = ref<Modality | null>(null)
function openNew() {
  editing.value = null
  formOpen.value = true
}
function openEdit(m: Modality) {
  editing.value = m
  formOpen.value = true
}

async function remove(m: Modality) {
  const count = mods.workoutsOf(m.id).length
  const hist = sessions.sessions.filter((s) => s.modalityId === m.id).length
  const ok = await confirmDialog({
    title: `Excluir "${m.name}"?`,
    message: `Serão excluídos ${count} treino(s) e a modalidade sairá do planejamento.${hist ? `\n\nOs ${hist} registro(s) do histórico são mantidos, mas deixam de aparecer nas rotações e estatísticas desta modalidade.` : ''}\n\nPara só pausar, prefira desativar.`,
    confirmText: 'Excluir',
    danger: true
  })
  if (!ok) return
  try {
    await plan.purgeModality(m.id)
    await mods.deleteModality(m.id)
    toast('Modalidade excluída.')
  } catch (e) {
    toastError(e)
  }
}

async function toggle(m: Modality) {
  try {
    await mods.saveModality({ ...m, active: !m.active })
  } catch (e) {
    toastError(e)
  }
}
async function move(m: Modality, d: -1 | 1) {
  try {
    await mods.moveModality(m.id, d)
  } catch (e) {
    toastError(e)
  }
}
async function demo() {
  try {
    await loadDemoData()
    toast('Exemplo carregado. Remova quando quiser em Configurações.')
  } catch (e) {
    toastError(e)
  }
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h1 class="h-page">Treinos</h1>
        <p class="muted mt-1">Modalidades, sequências de rotação e exercícios. Cada modalidade avança de forma independente.</p>
      </div>
      <button class="btn-primary shrink-0" @click="openNew"><Plus :size="18" /> Nova</button>
    </header>

    <EmptyState v-if="!mods.modalities.length" title="Nenhuma modalidade cadastrada" text="Crie a primeira modalidade (ex.: Musculação) e depois seus treinos. Ou carregue um exemplo para ver o app funcionando.">
      <template #icon><Dumbbell :size="32" /></template>
      <button class="btn-primary" @click="openNew"><Plus :size="18" /> Nova modalidade</button>
      <button class="btn-soft" @click="demo"><Sparkles :size="16" /> Carregar exemplo</button>
    </EmptyState>

    <ul class="space-y-3">
      <li v-for="(m, i) in mods.sortedModalities" :key="m.id" class="card !p-0 overflow-hidden" :class="m.active ? '' : 'opacity-70'" :style="{ borderLeft: `5px solid ${m.color}` }">
        <RouterLink :to="`/treinos/${m.id}`" class="flex items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <p class="truncate text-lg font-bold">{{ m.name }} <span v-if="!m.active" class="badge ml-1 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">inativa</span></p>
            <p class="muted">{{ CATEGORY_LABEL[m.category] }} · {{ mods.workoutsOf(m.id).length }} treino(s) · próximo: <strong class="text-slate-700 dark:text-slate-200">{{ sessions.nextFor(m.id)?.name ?? '—' }}</strong></p>
          </div>
          <ChevronRight :size="20" class="shrink-0 text-slate-400" />
        </RouterLink>
        <div class="flex items-center gap-1 border-t border-slate-100 px-2 py-1 dark:border-slate-800">
          <button class="icon-btn" :disabled="i === 0" aria-label="Mover para cima" @click="move(m, -1)"><ArrowUp :size="18" /></button>
          <button class="icon-btn" :disabled="i === mods.sortedModalities.length - 1" aria-label="Mover para baixo" @click="move(m, 1)"><ArrowDown :size="18" /></button>
          <button class="btn-ghost" @click="toggle(m)">{{ m.active ? 'Desativar' : 'Ativar' }}</button>
          <span class="flex-1" />
          <button class="icon-btn" aria-label="Editar modalidade" @click="openEdit(m)"><Pencil :size="18" /></button>
          <button class="icon-btn text-red-500" aria-label="Excluir modalidade" @click="remove(m)"><Trash2 :size="18" /></button>
        </div>
      </li>
    </ul>

    <ModalityForm :open="formOpen" :modality="editing" @close="formOpen = false" />
  </div>
</template>
