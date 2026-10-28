<script setup lang="ts">
import { reactive, watch } from 'vue'
import AppModal from './AppModal.vue'
import { CATEGORY_LABEL, PALETTE, useModalitiesStore } from '@/stores/modalities'
import type { LogType, Modality, ModalityCategory } from '@/types'
import { toastError } from '@/composables/useToast'

const props = defineProps<{ open: boolean; modality?: Modality | null }>()
const emit = defineEmits<{ close: []; saved: [Modality] }>()
const store = useModalitiesStore()

const form = reactive({ name: '', color: PALETTE[0], category: 'musculacao' as ModalityCategory, logType: 'sets' as LogType, active: true })

watch(
  () => props.open,
  (o) => {
    if (!o) return
    const m = props.modality
    form.name = m?.name ?? ''
    form.color = m?.color ?? PALETTE[store.modalities.length % PALETTE.length]
    form.category = m?.category ?? 'musculacao'
    form.logType = m?.logType ?? 'sets'
    form.active = m?.active ?? true
  }
)

function onCategory() {
  // sugestão de formato de registro; continua editável
  if (!props.modality) form.logType = form.category === 'musculacao' || form.category === 'casa' || form.category === 'calistenia' ? 'sets' : 'simple'
}

async function save() {
  try {
    const m = await store.saveModality({ ...form, id: props.modality?.id })
    emit('saved', m)
    emit('close')
  } catch (e) {
    toastError(e)
  }
}
</script>

<template>
  <AppModal :open="open" :title="modality ? 'Editar modalidade' : 'Nova modalidade'" @close="emit('close')">
    <form id="modality-form" class="space-y-4" @submit.prevent="save">
      <div>
        <label class="label" for="m-name">Nome</label>
        <input id="m-name" v-model="form.name" class="input" placeholder="Ex.: Musculação, Corrida, Barra" maxlength="40" required />
      </div>
      <div>
        <label class="label" for="m-cat">Categoria</label>
        <select id="m-cat" v-model="form.category" class="input" @change="onCategory">
          <option v-for="(label, k) in CATEGORY_LABEL" :key="k" :value="k">{{ label }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="m-log">Como registrar</label>
        <select id="m-log" v-model="form.logType" class="input">
          <option value="sets">Série a série (carga e repetições)</option>
          <option value="simple">Checklist simples (conclui os itens)</option>
        </select>
      </div>
      <div>
        <span class="label">Cor</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in PALETTE" :key="c" type="button" class="h-10 w-10 rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-slate-900"
            :class="form.color === c ? 'ring-2 ring-slate-900 dark:ring-white' : ''" :style="{ background: c }" :aria-label="`Cor ${c}`" :aria-pressed="form.color === c" @click="form.color = c"
          />
        </div>
      </div>
      <label class="flex min-h-[44px] items-center gap-3 text-sm font-medium">
        <input v-model="form.active" type="checkbox" class="h-5 w-5 rounded accent-brand-600" /> Modalidade ativa
      </label>
    </form>
    <template #footer>
      <div class="grid grid-cols-2 gap-2">
        <button class="btn-soft" type="button" @click="emit('close')">Cancelar</button>
        <button class="btn-primary" type="submit" form="modality-form">Salvar</button>
      </div>
    </template>
  </AppModal>
</template>
