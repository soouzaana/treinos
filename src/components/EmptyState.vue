<script setup lang="ts">
defineProps<{ title: string; text?: string }>()
</script>

<template>
  <div class="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
    <div v-if="$slots.icon" class="mb-3 text-slate-400"><slot name="icon" /></div>
    <p class="font-semibold">{{ title }}</p>
    <p v-if="text" class="muted mt-1 max-w-xs">{{ text }}</p>
    <div v-if="$slots.default" class="mt-4 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
