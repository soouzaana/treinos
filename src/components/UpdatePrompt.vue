<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const needRefresh = ref(false)
const offlineReady = ref(false)
let updateSW: ((reload?: boolean) => Promise<void>) | undefined

onMounted(() => {
  updateSW = registerSW({
    onNeedRefresh() {
      needRefresh.value = true
    },
    onOfflineReady() {
      offlineReady.value = true
      setTimeout(() => (offlineReady.value = false), 5000)
    }
  })
})
</script>

<template>
  <div v-if="needRefresh || offlineReady" class="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-sm rounded-2xl bg-slate-900 p-4 text-sm text-white shadow-xl dark:bg-slate-100 dark:text-slate-900 md:bottom-6" role="status">
    <template v-if="needRefresh">
      <p class="font-semibold">Nova versão disponível</p>
      <p class="mt-0.5 opacity-80">Seus dados continuam salvos. Atualize quando não estiver no meio de um treino.</p>
      <div class="mt-3 flex gap-2">
        <button class="btn bg-white/15 text-inherit" @click="needRefresh = false">Depois</button>
        <button class="btn bg-brand-500 text-white" @click="updateSW?.(true)">Atualizar</button>
      </div>
    </template>
    <p v-else class="font-semibold">Pronto para usar offline.</p>
  </div>
</template>
