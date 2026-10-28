<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
watch(
  () => props.open,
  (o) => {
    if (o) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" :aria-label="title">
      <div class="absolute inset-0 bg-slate-950/60" @click="emit('close')" />
      <div class="sheet-enter relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-3xl">
        <header class="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 class="text-lg font-bold">{{ title }}</h2>
          <button class="icon-btn -mr-2" aria-label="Fechar" @click="emit('close')"><X :size="20" /></button>
        </header>
        <div class="overflow-y-auto px-5 py-4">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
