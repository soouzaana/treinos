<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRightLeft, Check, Plus, RotateCcw, Timer } from 'lucide-vue-next'
import { useModalitiesStore } from '@/stores/modalities'
import { useSessionsStore } from '@/stores/sessions'
import { compareLastTwo, exerciseHistory, exerciseKey } from '@/services/progression'
import { wouldRepeatLast } from '@/services/rotation'
import { buildExerciseLogs } from '@/services/sessions'
import type { ExerciseLog, Session, Workout } from '@/types'
import { formatDM, formatDuration, formatLong, toDateKey } from '@/utils/date'
import { uid } from '@/utils/id'
import ExerciseLogCard from '@/components/ExerciseLogCard.vue'
import WorkoutPicker from '@/components/WorkoutPicker.vue'
import AppModal from '@/components/AppModal.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { toast, toastError } from '@/composables/useToast'
import { timerOpen, useRestTimer } from '@/composables/useRestTimer'

const route = useRoute()
const router = useRouter()
const mods = useModalitiesStore()
const sessions = useSessionsStore()
const rest = useRestTimer()

const date = String(route.params.date)
const modalityId = String(route.params.modalityId)
const modality = computed(() => mods.getModality(modalityId))
const draft = ref<Session | null>(null)
const missing = ref(false)
const saved = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let lastJson = ''
let timer: ReturnType<typeof setTimeout> | undefined
const nowTick = ref(Date.now())
let clock: ReturnType<typeof setInterval>

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
function setDraft(s: Session) {
  draft.value = clone(s)
  lastJson = JSON.stringify(draft.value)
}

onMounted(async () => {
  clock = setInterval(() => (nowTick.value = Date.now()), 1000)
  const m = modality.value
  if (!m) {
    missing.value = true
    return
  }
  try {
    let s = sessions.get(date, modalityId)
    if (!s || s.status === 'skipped') s = (await sessions.start(date, m)) ?? undefined
    if (!s) missing.value = true
    else setDraft(s)
  } catch (e) {
    toastError(e)
    missing.value = true
  }
})
onBeforeUnmount(() => {
  clearInterval(clock)
  void flush()
})

async function flush() {
  clearTimeout(timer)
  const d = draft.value
  if (!d) return
  const json = JSON.stringify(d)
  if (json === lastJson) return
  saved.value = 'saving'
  try {
    await sessions.update(clone(d))
    lastJson = json
    saved.value = 'saved'
  } catch {
    saved.value = 'error'
  }
}
watch(
  draft,
  () => {
    clearTimeout(timer)
    timer = setTimeout(flush, 500)
  },
  { deep: true }
)

const completed = computed(() => draft.value?.status === 'completed')
const elapsed = computed(() => {
  const d = draft.value
  if (!d?.startedAt || d.status === 'completed') return d?.durationSec ?? null
  return Math.max(0, Math.round((nowTick.value - d.startedAt) / 1000))
})
const isSets = computed(() => modality.value?.logType === 'sets')
const workout = computed(() => (draft.value ? mods.getWorkout(draft.value.workoutId) ?? null : null))

const refs = computed(() => {
  const map = new Map<string, { last: ReturnType<typeof exerciseHistory>[number] | null; cmp: ReturnType<typeof compareLastTwo> }>()
  if (!draft.value) return map
  for (const e of draft.value.exercises) {
    const hist = exerciseHistory(sessions.sessions, exerciseKey(e.name)).filter((h) => h.sessionId !== draft.value!.id)
    map.set(e.exerciseId, { last: hist[hist.length - 1] ?? null, cmp: compareLastTwo(hist) })
  }
  return map
})
const totalDone = computed(() => {
  const ex = draft.value?.exercises ?? []
  return isSets.value ? ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0) : ex.filter((e) => e.done).length
})
const totalAll = computed(() => {
  const ex = draft.value?.exercises ?? []
  return isSets.value ? ex.reduce((a, e) => a + e.sets.length, 0) : ex.length
})

function removeExercise(i: number) {
  const d = draft.value!
  const e = d.exercises[i]
  const has = e.done || e.sets.some((s) => s.done || s.reps)
  void (async () => {
    if (has && !(await confirmDialog({ title: `Remover "${e.name}"?`, message: 'Os dados registrados deste exercício nesta sessão serão perdidos.', confirmText: 'Remover', danger: true }))) return
    d.exercises.splice(i, 1)
  })()
}

// exercício avulso
const addOpen = ref(false)
const newName = ref('')
function addExercise() {
  const name = newName.value.trim()
  if (!name) return
  const log: ExerciseLog = {
    exerciseId: uid(), name, unit: 'kg', plannedSets: 3, plannedReps: '', plannedLoad: null, done: false,
    sets: isSets.value ? [{ n: 1, load: null, reps: null, done: false, notes: '' }] : []
  }
  draft.value!.exercises.push(log)
  newName.value = ''
  addOpen.value = false
}

// trocar treino
const swapOpen = ref(false)
async function pick(w: Workout) {
  swapOpen.value = false
  const d = draft.value
  const m = modality.value
  if (!d || !m || w.id === d.workoutId) return
  const hasData = d.exercises.some((x) => x.done || x.sets.some((s) => s.done || s.reps))
  if (hasData && !(await confirmDialog({ title: 'Trocar o treino?', message: 'Os exercícios registrados nesta sessão serão substituídos pelos do novo treino.', confirmText: 'Trocar', danger: true }))) return
  if (wouldRepeatLast(sessions.sessions, m.id, w.id, d.id) && !(await confirmDialog({ title: 'Repetir o mesmo treino?', message: `"${w.name}" foi o último concluído nesta modalidade. Usar mesmo assim?`, confirmText: 'Usar mesmo assim' }))) return
  try {
    clearTimeout(timer)
    await sessions.changeWorkout(d.id, w, m)
    const s = sessions.get(date, modalityId)
    if (s) setDraft(s)
    toast(`Treino trocado para ${w.name}`, 'info')
  } catch (e) {
    toastError(e)
  }
}

async function finish() {
  const m = modality.value
  const d = draft.value
  if (!m || !d) return
  if (isSets.value && totalDone.value === 0 && !(await confirmDialog({ title: 'Concluir sem nenhuma série registrada?', message: 'O treino conta para a rotação mesmo assim.', confirmText: 'Concluir' }))) return
  if (!isSets.value && totalDone.value < totalAll.value && totalAll.value > 0 && !(await confirmDialog({ title: 'Há itens sem marcar', message: `${totalAll.value - totalDone.value} item(ns) pendente(s). Concluir mesmo assim?`, confirmText: 'Concluir' }))) return
  try {
    await flush()
    const c = await sessions.complete(date, m)
    if (c) setDraft(c)
    rest.reset()
    const nxt = sessions.nextFor(m.id)
    toast(`${m.name} concluído${nxt ? ` · próximo: ${nxt.name}` : ''}`)
    await router.replace({ path: '/', query: date === toDateKey() ? {} : { d: date } })
  } catch (e) {
    toastError(e)
  }
}

async function reopen() {
  const d = draft.value
  if (!d) return
  if (!(await confirmDialog({ title: 'Reabrir este treino?', message: 'Ele deixa de contar na rotação até ser concluído de novo.', confirmText: 'Reabrir' }))) return
  await flush()
  await sessions.reopen(d.id)
  const s = sessions.get(date, modalityId)
  if (s) setDraft(s)
}

function rebuild() {
  const d = draft.value
  const w = workout.value
  const m = modality.value
  if (!d || !w || !m) return
  void (async () => {
    if (!(await confirmDialog({ title: 'Recarregar exercícios do treino?', message: 'Substitui os exercícios desta sessão pelos cadastrados no treino (o registro atual é perdido).', confirmText: 'Recarregar', danger: true }))) return
    d.exercises = buildExerciseLogs(w, m)
  })()
}
</script>

<template>
  <div v-if="missing" class="space-y-3 pt-8 text-center">
    <p class="font-semibold">Não foi possível abrir este treino.</p>
    <p class="muted">A modalidade pode ter sido excluída ou não há treino cadastrado.</p>
    <button class="btn-primary" @click="router.replace('/')">Voltar</button>
  </div>

  <div v-else-if="draft && modality" class="space-y-4">
    <header class="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div class="flex items-center gap-1">
        <button class="icon-btn -ml-2" aria-label="Voltar" @click="router.back()"><ArrowLeft :size="22" /></button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-bold uppercase tracking-wide" :style="{ color: modality.color }">{{ modality.name }} · {{ formatLong(date).split(',')[0] }} {{ formatDM(date) }}</p>
          <h1 class="truncate text-xl font-bold leading-tight">{{ draft.workoutName }}</h1>
        </div>
        <button class="icon-btn" aria-label="Trocar treino" @click="swapOpen = true"><ArrowRightLeft :size="20" /></button>
        <button class="icon-btn !h-11 !w-auto gap-1.5 px-3 text-slate-700 dark:text-slate-200" aria-label="Cronômetro de descanso" @click="timerOpen = true">
          <Timer :size="20" /><span v-if="rest.active.value" class="text-sm font-bold tabular-nums">{{ rest.clock.value }}</span>
        </button>
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span class="font-semibold" :class="completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">{{ completed ? 'Concluído' : 'Em andamento' }}</span>
        <span v-if="elapsed !== null">{{ formatDuration(elapsed) }}</span>
        <span>{{ totalDone }}/{{ totalAll }} {{ isSets ? 'séries' : 'itens' }}</span>
        <span v-if="draft.substituted" class="font-semibold text-violet-600 dark:text-violet-300">Substituição</span>
        <span v-if="draft.replacesModalityId" class="font-semibold text-violet-600 dark:text-violet-300">Substitui {{ mods.getModality(draft.replacesModalityId)?.name ?? 'musculação' }}<template v-if="draft.replacesWorkoutName"> · {{ draft.replacesWorkoutName }}</template></span>
        <span class="ml-auto" aria-live="polite">{{ saved === 'saving' ? 'Salvando…' : saved === 'saved' ? 'Salvo' : saved === 'error' ? 'Erro ao salvar' : '' }}</span>
      </div>
    </header>

    <p v-if="completed" class="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      Registro concluído: as alterações abaixo corrigem o histórico. Use “Reabrir” se quiser que ele deixe de contar na rotação.
    </p>

    <template v-if="isSets">
      <ExerciseLogCard
        v-for="(e, i) in draft.exercises" :key="e.exerciseId" :log="e"
        :last="refs.get(e.exerciseId)?.last ?? null" :comparison="refs.get(e.exerciseId)?.cmp ?? null"
        @set-done="rest.autoStart(e.plannedRestSec)" @remove="removeExercise(i)"
      />
    </template>
    <section v-else class="card !p-2">
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="(e, i) in draft.exercises" :key="e.exerciseId" class="flex items-center gap-3 p-2">
          <button
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-90"
            :class="e.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent dark:border-slate-600'"
            :aria-pressed="e.done" :aria-label="`${e.name} concluído`" @click="e.done = !e.done"
          ><Check :size="24" :stroke-width="3" /></button>
          <div class="min-w-0 flex-1">
            <p class="font-semibold" :class="e.done ? 'line-through opacity-60' : ''">{{ e.name }}</p>
            <p v-if="e.plannedReps" class="muted">{{ e.plannedReps }}</p>
          </div>
          <button class="icon-btn" aria-label="Remover item" @click="removeExercise(i)">×</button>
        </li>
      </ul>
    </section>

    <p v-if="!draft.exercises.length" class="muted text-center">Nenhum exercício nesta sessão. Adicione abaixo ou recarregue os do treino.</p>
    <div class="flex flex-wrap gap-2">
      <button class="btn-soft" @click="addOpen = true"><Plus :size="16" /> {{ isSets ? 'Exercício' : 'Item' }} avulso</button>
      <button v-if="workout" class="btn-ghost" @click="rebuild"><RotateCcw :size="16" /> Recarregar do treino</button>
    </div>

    <section class="card">
      <label class="label" for="s-notes">Observações da sessão</label>
      <textarea id="s-notes" v-model="draft.notes" class="input min-h-[84px]" placeholder="Como foi? Dor, sensação, ajuste de carga…" maxlength="1000" />
    </section>

    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div class="mx-auto flex max-w-3xl gap-2 md:pl-60">
        <button v-if="completed" class="btn-soft flex-1" @click="reopen"><RotateCcw :size="18" /> Reabrir</button>
        <button v-if="completed" class="btn-primary flex-1" @click="router.back()"><Check :size="18" /> Fechar</button>
        <button v-else class="btn-primary !min-h-[52px] w-full text-base" @click="finish"><Check :size="20" /> Concluir {{ modality.name.toLowerCase() }}</button>
      </div>
    </div>

    <WorkoutPicker :open="swapOpen" :modality-id="modalityId" :current-id="draft.workoutId" :suggested-id="draft.suggestedWorkoutId" @close="swapOpen = false" @pick="pick" />
    <AppModal :open="addOpen" :title="isSets ? 'Exercício avulso' : 'Item avulso'" @close="addOpen = false">
      <form class="space-y-3" @submit.prevent="addExercise">
        <input v-model="newName" class="input" placeholder="Nome" maxlength="60" autofocus />
        <p class="muted">Vale só para esta sessão; não altera o treino cadastrado.</p>
        <button class="btn-primary w-full" type="submit">Adicionar</button>
      </form>
    </AppModal>
  </div>
</template>
