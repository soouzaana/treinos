<script setup lang="ts">
import { toasts } from '@/composables/useToast'
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="sheet-enter pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg"
      :class="{
        'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900': t.kind !== 'error',
        'bg-red-600 text-white': t.kind === 'error'
      }"
      role="status"
    >
      {{ t.text }}
    </div>
  </div>
</template>
