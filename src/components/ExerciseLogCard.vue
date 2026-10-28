<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, MessageSquare, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-vue-next'
import type { ExerciseLog, SetLog } from '@/types'
import type { ExerciseComparison, ExerciseSessionSummary } from '@/services/progression'
import { formatDM } from '@/utils/date'

const props = defineProps<{ log: ExerciseLog; last: ExerciseSessionSummary | null; comparison: ExerciseComparison | null }>()
const emit = defineEmits<{ setDone: []; remove: [] }>()

const noteOpen = ref<number | null>(null)
const doneCount = computed(() => props.log.sets.filter((s) => s.done).length)

function num(v: string): number | null {
  const n = Number(v.replace(',', '.'))
  return v.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n
}
function setLoad(s: SetLog, e: Event) {
  s.load = num((e.target as HTMLInputElement).value)
}
function setReps(s: SetLog, e: Event) {
  const v = num((e.target as HTMLInputElement).value)
  s.reps = v === null ? null : Math.round(v)
}
function toggle(s: SetLog) {
  s.done = !s.done
  if (s.done) {
    if (s.reps === null && /^\d+$/.test(props.log.plannedReps.trim())) s.reps = Number(props.log.plannedReps)
    emit('setDone')
  }
}
function addSet() {
  const prev = props.log.sets[props.log.sets.length - 1]
  props.log.sets.push({ n: props.log.sets.length + 1, load: prev?.load ?? props.log.plannedLoad, reps: null, done: false, notes: '' })
}
function removeSet(i: number) {
  props.log.sets.splice(i, 1)
  props.log.sets.forEach((s, k) => (s.n = k + 1))
  noteOpen.value = null
}
const lastText = computed(() => {
  const l = props.last
  if (!l) return null
  return `${formatDM(l.date)}: ${l.doneSets} série${l.doneSets > 1 ? 's' : ''} · máx. ${l.maxLoad} ${l.unit} × ${l.repsAtMaxLoad}`
})
</script>

<template>
  <section class="card">
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="truncate text-lg font-bold">{{ log.name }}</h3>
        <p class="muted">
          Planejado: {{ log.plannedSets }}×{{ log.plannedReps }}<template v-if="log.plannedLoad !== null"> · {{ log.plannedLoad }} {{ log.unit }}</template><template v-if="log.plannedDurationSec"> · {{ log.plannedDurationSec }} s</template><template v-if="log.plannedRestSec"> · descanso {{ log.plannedRestSec }} s</template>
          · <span class="font-semibold" :class="doneCount >= log.plannedSets ? 'text-emerald-600 dark:text-emerald-400' : ''">{{ doneCount }}/{{ log.sets.length }} feitas</span>
        </p>
        <p v-if="lastText" class="muted mt-0.5 flex flex-wrap items-center gap-x-2">
          <span>Última vez {{ lastText }}</span>
          <span
            v-if="comparison" class="badge"
            :class="comparison.evolution === 'evolucao' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : comparison.evolution === 'regressao' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'"
          >
            <TrendingUp v-if="comparison.evolution === 'evolucao'" :size="12" /><TrendingDown v-else-if="comparison.evolution === 'regressao'" :size="12" /><Minus v-else :size="12" />
            {{ comparison.evolution === 'evolucao' ? 'Evolução' : comparison.evolution === 'regressao' ? 'Regressão' : 'Manutenção' }}
          </span>
        </p>
      </div>
      <button class="icon-btn -mr-2 -mt-1" aria-label="Remover exercício desta sessão" @click="emit('remove')"><Trash2 :size="18" /></button>
    </header>

    <div class="mt-3">
      <div class="grid grid-cols-[2rem_1fr_1fr_3.25rem_2.5rem] items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        <span>Sér.</span><span>Carga ({{ log.unit }})</span><span>Reps</span><span class="text-center">Feita</span><span />
      </div>
      <div v-for="(s, i) in log.sets" :key="i" class="mt-1.5">
        <div class="grid grid-cols-[2rem_1fr_1fr_3.25rem_2.5rem] items-center gap-2">
          <span class="text-center text-sm font-bold text-slate-500">{{ s.n }}</span>
          <input class="input !min-h-[48px] text-center text-lg font-semibold tabular-nums" type="text" inputmode="decimal" :value="s.load ?? ''" :aria-label="`Carga da série ${s.n}`" placeholder="—" @input="setLoad(s, $event)" />
          <input class="input !min-h-[48px] text-center text-lg font-semibold tabular-nums" type="text" inputmode="numeric" :value="s.reps ?? ''" :aria-label="`Repetições da série ${s.n}`" placeholder="—" @input="setReps(s, $event)" />
          <button
            class="flex h-12 w-full items-center justify-center rounded-xl border-2 transition active:scale-90"
            :class="s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent dark:border-slate-600'"
            :aria-pressed="s.done" :aria-label="`Série ${s.n} concluída`" @click="toggle(s)"
          ><Check :size="24" :stroke-width="3" /></button>
          <button class="icon-btn !h-10 !w-10" :aria-label="`Observação ou remover série ${s.n}`" @click="noteOpen = noteOpen === i ? null : i">
            <MessageSquare :size="16" :class="s.notes ? 'text-brand-600' : ''" />
          </button>
        </div>
        <div v-if="noteOpen === i" class="mt-1.5 flex gap-2">
          <input v-model="s.notes" class="input" placeholder="Observação da série (opcional)" maxlength="200" />
          <button class="btn-danger-soft shrink-0 !px-3" aria-label="Remover série" @click="removeSet(i)"><Trash2 :size="16" /></button>
        </div>
      </div>
      <button class="btn-soft mt-3 w-full" @click="addSet"><Plus :size="16" /> Série</button>
    </div>
  </section>
</template>
