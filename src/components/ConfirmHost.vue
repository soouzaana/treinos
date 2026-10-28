<script setup lang="ts">
import { answerConfirm, pendingConfirm } from '@/composables/useConfirm'
</script>

<template>
  <Teleport to="body">
    <div v-if="pendingConfirm" class="fixed inset-0 z-[70] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div class="absolute inset-0 bg-slate-950/70" @click="answerConfirm(false)" />
      <div class="sheet-enter relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <h3 class="text-lg font-bold">{{ pendingConfirm.title }}</h3>
        <p v-if="pendingConfirm.message" class="muted mt-2 whitespace-pre-line">{{ pendingConfirm.message }}</p>
        <div class="mt-5 grid grid-cols-2 gap-2">
          <button class="btn-soft" @click="answerConfirm(false)">{{ pendingConfirm.cancelText ?? 'Cancelar' }}</button>
          <button :class="pendingConfirm.danger ? 'btn-danger' : 'btn-primary'" @click="answerConfirm(true)">
            {{ pendingConfirm.confirmText ?? 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
