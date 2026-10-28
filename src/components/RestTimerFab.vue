<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-vue-next'
import AppModal from './AppModal.vue'
import { timerNote, timerOpen, useRestTimer } from '@/composables/useRestTimer'
import { PRESETS_SEC } from '@/services/timer'

const t = useRestTimer()
const custom = ref<number | null>(null)
const R = 54
const C = 2 * Math.PI * R
const dash = computed(() => C * (1 - t.progress.value))
const finished = computed(() => t.state.value.status === 'finished')

function startCustom() {
  const v = Math.round(Number(custom.value))
  if (v >= 1 && v <= 3600) t.start(v)
}
</script>

<template>
  <button
    class="fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full px-4 font-bold shadow-lg transition active:scale-95 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6"
    :class="
      finished
        ? 'animate-pulse bg-emerald-500 text-white'
        : t.active.value
          ? 'bg-brand-600 text-white'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
    "
    aria-label="Abrir cronômetro de descanso"
    @click="timerOpen = true"
  >
    <Timer :size="22" />
    <span v-if="t.active.value" class="tabular-nums">{{ finished ? 'Fim!' : t.clock.value }}</span>
  </button>

  <AppModal :open="timerOpen" title="Descanso" @close="timerOpen = false">
    <div class="flex flex-col items-center">
      <div class="relative h-56 w-56">
        <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
          <circle cx="60" cy="60" :r="R" fill="none" stroke-width="8" class="stroke-slate-200 dark:stroke-slate-800" />
          <circle
            cx="60" cy="60" :r="R" fill="none" stroke-width="8" stroke-linecap="round"
            :stroke-dasharray="C" :stroke-dashoffset="dash"
            :class="finished ? 'stroke-emerald-500' : 'stroke-brand-500'"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-5xl font-bold tabular-nums" aria-live="off">{{ t.clock.value }}</span>
          <span class="muted mt-1">
            {{ finished ? 'Descanso concluído' : t.state.value.status === 'paused' ? 'Pausado' : t.state.value.status === 'running' ? 'Descansando…' : 'Escolha um tempo' }}
          </span>
        </div>
      </div>

      <p v-if="timerNote" class="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
        {{ timerNote }}
        <button class="icon-btn !h-7 !w-7" aria-label="Dispensar aviso" @click="timerNote = null"><X :size="14" /></button>
      </p>

      <div class="mt-4 grid w-full grid-cols-3 gap-2">
        <button
          v-if="t.state.value.status === 'running'"
          class="btn-primary col-span-2 !min-h-[56px] text-base" @click="t.pause()"
        ><Pause :size="20" /> Pausar</button>
        <button
          v-else-if="t.state.value.status === 'paused'"
          class="btn-primary col-span-2 !min-h-[56px] text-base" @click="t.resume()"
        ><Play :size="20" /> Retomar</button>
        <button v-else class="btn-primary col-span-2 !min-h-[56px] text-base" @click="t.restart()">
          <RotateCcw :size="20" /> {{ finished ? 'Descansar de novo' : `Iniciar ${Math.round(t.state.value.durationMs / 1000)}s` }}
        </button>
        <button class="btn-soft !min-h-[56px]" :disabled="!t.active.value" @click="t.reset()">Zerar</button>
      </div>
      <button v-if="t.state.value.status === 'running' || t.state.value.status === 'paused'" class="btn-soft mt-2 w-full" @click="t.restart()">
        <RotateCcw :size="18" /> Reiniciar contagem
      </button>

      <div class="mt-5 w-full">
        <p class="label">Tempos rápidos (toque para iniciar)</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="s in PRESETS_SEC" :key="s"
            class="btn-soft !min-h-[52px] text-base"
            :class="Math.round(t.state.value.durationMs / 1000) === s ? 'ring-2 ring-brand-500' : ''"
            @click="t.start(s)"
          >{{ s }}s</button>
        </div>
        <p class="label mt-4">Tempo personalizado (segundos)</p>
        <form class="flex gap-2" @submit.prevent="startCustom">
          <input v-model.number="custom" type="number" inputmode="numeric" min="1" max="3600" class="input" placeholder="Ex.: 75" />
          <button class="btn-primary shrink-0" type="submit">Iniciar</button>
        </form>
      </div>
    </div>
  </AppModal>
</template>
