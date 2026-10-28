<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CalendarX2, ChevronLeft, ChevronRight, Dumbbell, Plus, Sparkles } from 'lucide-vue-next'
import { useModalitiesStore } from '@/stores/modalities'
import { usePlanStore } from '@/stores/plan'
import { useSessionsStore } from '@/stores/sessions'
import { wouldRepeatLast } from '@/services/rotation'
import { applySwaps, canSubstitute, findHomeModality, swapTo } from '@/services/substitution'
import { rangeStats } from '@/services/stats'
import { addDays, formatDM, formatLong, startOfWeek, toDateKey, weekdayOf, WEEKDAYS_SHORT, weekKeys } from '@/utils/date'
import type { Modality, Workout } from '@/types'
import TodayCard from '@/components/TodayCard.vue'
import WorkoutPicker from '@/components/WorkoutPicker.vue'
import AppModal from '@/components/AppModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { toast, toastError } from '@/composables/useToast'
import { loadDemoData } from '@/composables/useDemo'

const route = useRoute()
const router = useRouter()
const mods = useModalitiesStore()
const plan = usePlanStore()
const sessions = useSessionsStore()

const today = toDateKey()
const date = computed(() => (typeof route.query.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.d) ? route.query.d : today))
const isToday = computed(() => date.value === today)
const day = computed(() => plan.dayOf(weekdayOf(date.value)))

function go(delta: number) {
  const d = addDays(date.value, delta)
  void router.replace({ query: d === today ? {} : { d } })
}

/** Escolhas de troca feitas antes de a sessão existir (modalityId -> workoutId). */
const override = ref<Record<string, string>>({})

const basePlannedIds = computed(() => (day.value.rest ? [] : day.value.modalityIds.filter((id) => mods.getModality(id)?.active)))
/** Substituições do dia (ex.: Musculação → Treino em Casa) aplicadas ao plano, sem alterá-lo. */
const swapsToday = computed(() => sessions.swapsOn(date.value))
const plannedIds = computed(() => applySwaps(basePlannedIds.value, swapsToday.value, date.value, (id) => !!mods.getModality(id)?.active))
const home = computed(() => findHomeModality(mods.modalities))
const homeReady = computed(() => !!home.value && mods.workoutsOf(home.value.id).some((w) => w.active))
const extraIds = computed(() =>
  sessions.byDate(date.value).map((s) => s.modalityId).filter((id) => !plannedIds.value.includes(id) && mods.getModality(id))
)
const entries = computed(() =>
  [...plannedIds.value, ...extraIds.value].map((id) => {
    const modality = mods.getModality(id)!
    const session = sessions.get(date.value, id)
    const suggested = sessions.suggestionFor(id, date.value, session?.id)
    const chosen = session && session.status !== 'skipped'
      ? mods.getWorkout(session.workoutId) ?? null
      : override.value[id] ? mods.getWorkout(override.value[id]) ?? suggested : suggested
    const sw = swapTo(swapsToday.value, date.value, id)
    const fromId = sw?.fromModalityId ?? session?.replacesModalityId ?? null
    const swapInfo = fromId ? { modalityName: mods.getModality(fromId)?.name ?? 'Musculação', workoutName: sw?.originalWorkoutName ?? session?.replacesWorkoutName ?? null } : null
    const planned = plannedIds.value.includes(id)
    return {
      modality, session, suggested, workout: chosen, next: sessions.nextFor(id), planned, swap: sw, swapInfo,
      canSubstitute: planned && homeReady.value && canSubstitute(modality, home.value, !!session, !!sessions.swapOf(date.value, id))
    }
  })
)
const title = computed(() => {
  if (day.value.rest && !entries.value.length) return 'Descanso'
  const names = plannedIds.value.map((id) => mods.getModality(id)!.name.toUpperCase())
  return names.length ? names.join(' + ') : 'Sem treinos previstos'
})

// ---- semana
const week = computed(() => weekKeys(date.value))
const weekStats = computed(() =>
  rangeStats(week.value[0], week.value[6], today, plan.days, mods.modalities, sessions.sessions, undefined, sessions.swaps)
)
type DayState = 'none' | 'done' | 'part' | 'miss' | 'todo'
function dayInfo(d: string) {
  const pd = plan.dayOf(weekdayOf(d))
  const ids = pd.rest ? [] : pd.modalityIds.filter((id) => mods.getModality(id)?.active)
  const ss = sessions.byDate(d)
  const done = ss.filter((s) => s.status === 'completed').length
  const planned = ids.length
  const state: DayState = planned === 0 && done === 0 ? 'none' : done >= Math.max(planned, 1) ? 'done' : done > 0 ? 'part' : d < today ? 'miss' : 'todo'
  return { planned, done, state }
}
const dotClass: Record<DayState, string> = {
  none: 'bg-slate-100 text-slate-400 dark:bg-slate-800',
  done: 'bg-emerald-500 text-white',
  part: 'bg-amber-400 text-slate-900',
  miss: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  todo: 'bg-white text-slate-600 ring-1 ring-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
}

// ---- sessões interrompidas (de dias anteriores)
const interrupted = computed(() => sessions.inProgress.filter((s) => s.date < date.value).sort((a, b) => b.date.localeCompare(a.date)))

// ---- ações
const busy = ref(false)
async function guard(fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  try {
    await fn()
  } catch (e) {
    toastError(e, 'Não foi possível salvar. Tente novamente.')
  } finally {
    busy.value = false
  }
}

async function confirmRepeat(modality: Modality, workout: Workout | null, excludeId?: string): Promise<boolean> {
  if (!workout || !wouldRepeatLast(sessions.sessions, modality.id, workout.id, excludeId)) return true
  return confirmDialog({
    title: 'Repetir o mesmo treino?',
    message: `"${workout.name}" foi o último treino concluído de ${modality.name}. Normalmente a rotação segue para o próximo.\n\nRegistrar mesmo assim?`,
    confirmText: 'Registrar mesmo assim'
  })
}

function openRunner(modalityId: string) {
  void router.push({ name: 'sessao', params: { date: date.value, modalityId } })
}

const entry = (id: string) => entries.value.find((e) => e.modality.id === id)

function start(id: string) {
  void guard(async () => {
    const e = entry(id)
    if (!e) return
    if (!e.session || e.session.status === 'skipped') {
      if (!(await confirmRepeat(e.modality, e.workout, e.session?.id))) return
      const s = await sessions.start(date.value, e.modality, e.workout ?? undefined)
      if (!s) return toast('Cadastre um treino para esta modalidade primeiro.', 'error')
      delete override.value[id]
    }
    openRunner(id)
  })
}

function complete(id: string) {
  void guard(async () => {
    const e = entry(id)
    if (!e) return
    if (!e.session || e.session.status === 'skipped') {
      if (!(await confirmRepeat(e.modality, e.workout, e.session?.id))) return
    }
    const s = await sessions.complete(date.value, e.modality, e.workout ?? undefined)
    if (!s) return toast('Cadastre um treino para esta modalidade primeiro.', 'error')
    delete override.value[id]
    const nxt = sessions.nextFor(id)
    toast(`${e.modality.name} concluído${nxt ? ` · próximo: ${nxt.name}` : ''}`)
  })
}

function skip(id: string) {
  void guard(async () => {
    const e = entry(id)
    if (!e) return
    const ok = await confirmDialog({
      title: 'Registrar que não treinou?',
      message: `${e.modality.name} fica como não realizado e a rotação NÃO avança.${e.session?.status === 'in_progress' ? '\n\nO progresso já registrado nesta sessão será substituído.' : ''}`,
      confirmText: 'Não treinei'
    })
    if (!ok) return
    await sessions.skip(date.value, e.modality)
    toast('Registrado como não realizado. A rotação continua no mesmo treino.', 'info')
  })
}

function skipAll() {
  void guard(async () => {
    const pending = entries.value.filter((e) => !e.session)
    if (!pending.length) return
    const ok = await confirmDialog({
      title: 'Não treinei hoje',
      message: `Registrar ${pending.map((e) => e.modality.name).join(', ')} como não realizado(s)? Nenhuma sequência avança.`,
      confirmText: 'Confirmar'
    })
    if (!ok) return
    for (const e of pending) await sessions.skip(date.value, e.modality)
    toast('Ausência registrada.', 'info')
  })
}

function undoSkip(id: string) {
  void guard(() => sessions.clearSkip(date.value, id))
}

function reopen(id: string) {
  void guard(async () => {
    const e = entry(id)
    if (!e) return
    const ok = await confirmDialog({
      title: 'Reabrir este treino?',
      message: 'Ele deixa de contar na rotação até ser concluído de novo, e as próximas sugestões são recalculadas.',
      confirmText: 'Reabrir'
    })
    if (ok) await sessions.reopen(e.session!.id)
  })
}

// ---- substituir musculação por treino em casa
function substitute(id: string) {
  void guard(async () => {
    const e = entry(id)
    const h = home.value
    if (!e || !h) return
    await sessions.substitute(date.value, e.modality, h)
    delete override.value[h.id]
    const nxt = sessions.suggestionFor(h.id, date.value)
    toast(`${e.modality.name} substituída · ${nxt?.name ?? h.name}`, 'info')
  })
}

function cancelSwap(id: string) {
  void guard(async () => {
    const e = entry(id)
    const sw = e?.swap
    if (!e || !sw) return
    let r = await sessions.cancelSubstitution(date.value, sw.fromModalityId)
    if (r === 'needs-confirm') {
      const ok = await confirmDialog({
        title: 'Cancelar a substituição?',
        message: `${e.modality.name} já foi iniciado neste dia. Cancelar exclui esse registro (inclusive as séries anotadas) e devolve ${e.swapInfo?.modalityName ?? 'a musculação'}${sw.originalWorkoutName ? ` · ${sw.originalWorkoutName}` : ''} ao dia.\n\nPara só corrigir o registro, use "Ver / editar".`,
        confirmText: 'Excluir registro e voltar',
        danger: true
      })
      if (!ok) return
      r = await sessions.cancelSubstitution(date.value, sw.fromModalityId, true)
    }
    delete override.value[id]
    toast(`Voltou para ${e.swapInfo?.modalityName ?? 'a musculação'}.`, 'info')
  })
}

// ---- trocar treino
const swapFor = ref<string | null>(null)
const swapEntry = computed(() => (swapFor.value ? entry(swapFor.value) : undefined))
function pick(w: Workout) {
  const e = swapEntry.value
  swapFor.value = null
  if (!e) return
  void guard(async () => {
    if (e.session && e.session.status === 'in_progress') {
      const hasData = e.session.exercises.some((x) => x.done || x.sets.some((s) => s.done || s.reps))
      if (hasData && w.id !== e.session.workoutId) {
        const ok = await confirmDialog({
          title: 'Trocar o treino em andamento?',
          message: 'Os exercícios registrados nesta sessão serão substituídos pelos do novo treino.',
          confirmText: 'Trocar',
          danger: true
        })
        if (!ok) return
      }
      await sessions.changeWorkout(e.session.id, w, e.modality)
    } else {
      override.value = { ...override.value, [e.modality.id]: w.id }
    }
    toast(w.id === e.suggested?.id ? 'Treino sugerido restaurado.' : `Substituição: ${w.name}`, 'info')
  })
}

// ---- treino extra
const extraOpen = ref(false)
const extraOptions = computed(() => mods.activeModalities.filter((m) => !entries.value.some((e) => e.modality.id === m.id) && mods.workoutsOf(m.id).some((w) => w.active)))
function addExtra(m: Modality) {
  extraOpen.value = false
  void guard(async () => {
    const s = await sessions.start(date.value, m)
    if (s) openRunner(m.id)
  })
}

async function demo() {
  try {
    await loadDemoData()
    toast('Exemplo carregado. Você pode removê-lo em Configurações.')
  } catch (e) {
    toastError(e)
  }
}
const pendingCount = computed(() => entries.value.filter((e) => !e.session).length)
</script>

<template>
  <div class="space-y-5">
    <header>
      <div class="flex items-center justify-between gap-2">
        <button class="icon-btn" aria-label="Dia anterior" @click="go(-1)"><ChevronLeft :size="22" /></button>
        <div class="text-center">
          <p class="muted">{{ isToday ? 'Hoje' : date < today ? 'Dia anterior' : 'Dia futuro' }} · {{ formatLong(date) }}</p>
          <h1 class="h-page mt-0.5 leading-tight">{{ title }}</h1>
        </div>
        <button class="icon-btn" aria-label="Próximo dia" @click="go(1)"><ChevronRight :size="22" /></button>
      </div>
      <p v-if="!isToday" class="mt-2 text-center">
        <button class="btn-ghost" @click="router.replace({ query: {} })">Voltar para hoje</button>
      </p>
    </header>

    <section v-if="interrupted.length" class="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <p class="font-semibold text-amber-900 dark:text-amber-200">Treino interrompido</p>
      <ul class="mt-2 space-y-2">
        <li v-for="s in interrupted" :key="s.id" class="flex items-center justify-between gap-2 text-sm">
          <span class="text-amber-900 dark:text-amber-100">{{ mods.getModality(s.modalityId)?.name ?? 'Modalidade' }} · {{ s.workoutName }} · {{ formatDM(s.date) }}</span>
          <RouterLink class="btn-soft !min-h-[40px]" :to="{ name: 'sessao', params: { date: s.date, modalityId: s.modalityId } }">Retomar</RouterLink>
        </li>
      </ul>
    </section>

    <EmptyState v-if="!mods.activeModalities.some((m) => m.category !== 'casa')" title="Comece cadastrando suas modalidades" text="Crie modalidades (musculação, corrida, barra…), seus treinos e o planejamento semanal. Ou carregue um exemplo editável e removível.">
      <template #icon><Dumbbell :size="32" /></template>
      <RouterLink to="/treinos" class="btn-primary">Cadastrar modalidades</RouterLink>
      <button class="btn-soft" @click="demo"><Sparkles :size="16" /> Carregar exemplo</button>
    </EmptyState>

    <template v-else>
      <EmptyState v-if="!entries.length" :title="day.rest ? 'Dia de descanso' : 'Nenhum treino previsto para este dia'" :text="day.rest ? 'Recupere-se. Se treinar mesmo assim, adicione um treino extra.' : 'Defina as modalidades de cada dia em Planejamento.'">
        <template #icon><CalendarX2 :size="32" /></template>
        <RouterLink to="/planejamento" class="btn-soft">Abrir planejamento</RouterLink>
      </EmptyState>

      <TodayCard
        v-for="e in entries" :key="e.modality.id"
        :modality="e.modality" :session="e.session" :workout="e.workout" :suggested="e.suggested" :next="e.next" :planned="e.planned"
        :swap-info="e.swapInfo" :can-substitute="e.canSubstitute" :can-cancel-swap="!!e.swap"
        @substitute="substitute(e.modality.id)" @cancel-swap="cancelSwap(e.modality.id)" @start="start(e.modality.id)" @complete="complete(e.modality.id)" @skip="skip(e.modality.id)" @undo-skip="undoSkip(e.modality.id)"
        @reopen="reopen(e.modality.id)" @edit="openRunner(e.modality.id)" @swap="swapFor = e.modality.id"
      />

      <div class="flex flex-wrap gap-2">
        <button v-if="pendingCount > 1" class="btn-soft" @click="skipAll"><CalendarX2 :size="16" /> Não treinei {{ isToday ? 'hoje' : 'neste dia' }}</button>
        <button class="btn-ghost" :disabled="!extraOptions.length" @click="extraOpen = true"><Plus :size="16" /> Treino extra</button>
      </div>

      <section class="card">
        <div class="flex items-baseline justify-between">
          <h2 class="font-bold">Semana</h2>
          <p class="muted">{{ weekStats.completed }} de {{ weekStats.planned }} concluídos<template v-if="weekStats.extra"> · +{{ weekStats.extra }} extra</template></p>
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" :aria-valuenow="weekStats.rate ?? 0" aria-valuemin="0" aria-valuemax="100">
          <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${weekStats.rate ?? 0}%` }" />
        </div>
        <div class="mt-3 grid grid-cols-7 gap-1.5 text-center">
          <button
            v-for="d in week" :key="d" class="rounded-xl py-1.5 text-xs font-semibold transition active:scale-95"
            :class="[dotClass[dayInfo(d).state], d === date ? 'outline outline-2 outline-offset-1 outline-brand-500' : '']"
            :aria-label="`${formatLong(d)}: ${dayInfo(d).done} de ${dayInfo(d).planned}`"
            @click="router.replace({ query: d === today ? {} : { d } })"
          >
            <span class="block">{{ WEEKDAYS_SHORT[weekdayOf(d)] }}</span>
            <span class="block tabular-nums">{{ dayInfo(d).planned || dayInfo(d).done ? `${dayInfo(d).done}/${Math.max(dayInfo(d).planned, dayInfo(d).done)}` : '–' }}</span>
          </button>
        </div>
        <p class="muted mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <span>Iniciados: {{ weekStats.started }}</span><span>Não realizados: {{ weekStats.skipped }}</span><span>Pendentes passados: {{ weekStats.notDone }}</span>
        </p>
      </section>

      <section class="card">
        <h2 class="font-bold">Próximo treino de cada modalidade</h2>
        <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="m in mods.activeModalities" :key="m.id" class="flex items-center justify-between py-2.5">
            <span class="flex items-center gap-2 font-medium"><span class="h-3 w-3 rounded-full" :style="{ background: m.color }" /> {{ m.name }}</span>
            <span class="text-sm font-semibold">{{ sessions.nextFor(m.id)?.name ?? '—' }}</span>
          </li>
        </ul>
        <p class="muted mt-2">Só treinos concluídos fazem a rotação avançar.</p>
      </section>
    </template>

    <WorkoutPicker
      :open="!!swapFor" :modality-id="swapFor ?? ''" :current-id="swapEntry?.workout?.id ?? null" :suggested-id="swapEntry?.suggested?.id ?? null"
      @close="swapFor = null" @pick="pick"
    />
    <AppModal :open="extraOpen" title="Treino extra" @close="extraOpen = false">
      <p class="muted mb-3">Modalidades fora do planejamento deste dia. Recebem o próximo treino da rotação.</p>
      <ul class="space-y-2">
        <li v-for="m in extraOptions" :key="m.id">
          <button class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" @click="addExtra(m)">
            <span class="h-3 w-3 rounded-full" :style="{ background: m.color }" /> {{ m.name }}
          </button>
        </li>
      </ul>
    </AppModal>
  </div>
</template>
