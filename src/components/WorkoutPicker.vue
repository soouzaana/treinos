<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import AppModal from './AppModal.vue'
import { useModalitiesStore } from '@/stores/modalities'
import type { Workout } from '@/types'

const props = defineProps<{ open: boolean; modalityId: string; currentId?: string | null; suggestedId?: string | null }>()
const emit = defineEmits<{ close: []; pick: [Workout] }>()
const store = useModalitiesStore()
const list = computed(() => store.workoutsOf(props.modalityId).filter((w) => w.active || w.id === props.currentId))
</script>

<template>
  <AppModal :open="open" title="Trocar treino" @close="emit('close')">
    <p class="muted mb-3">A troca fica registrada como substituição e a rotação continua a partir do treino que você realmente fizer.</p>
    <ul class="space-y-2">
      <li v-for="w in list" :key="w.id">
        <button
          class="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99]"
          :class="w.id === currentId ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'"
          @click="emit('pick', w)"
        >
          <span>
            <span class="block font-semibold">{{ w.name }}</span>
            <span class="muted">{{ w.exercises.length }} {{ w.exercises.length === 1 ? 'item' : 'itens' }}<template v-if="w.id === suggestedId"> · sugerido pela rotação</template></span>
          </span>
          <Check v-if="w.id === currentId" :size="20" class="text-brand-600" />
        </button>
      </li>
    </ul>
  </AppModal>
</template>
