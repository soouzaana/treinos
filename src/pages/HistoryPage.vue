<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { House, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-vue-next'
import { useModalitiesStore } from '@/stores/modalities'
import { useSessionsStore } from '@/stores/sessions'
import { useTafStore } from '@/stores/taf'
import type { Modality, Session } from '@/types'
import { formatDM, formatDuration, formatLong, fromDateKey, monthKey, toDateKey } from '@/utils/date'
import CalendarMonth, { type DayMark } from '@/components/CalendarMonth.vue'
import AppModal from '@/components/AppModal.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { toast, toastError } from '@/composables/useToast'

const router = useRouter()
const mods = useModalitiesStore()
const sessions = useSessionsStore()
const taf = useTafStore()

const today = toDateKey()
const selected = ref(today)
const view = ref({ year: new Date().getFullYear(), month: new Date().getMonth() })
const mk = computed(() => `${view.value.year}-${String(view.value.month + 1).padStart(2, '0')}`)

function nav(d: number) {
  const dt = new Date(view.value.year, view.value.month + d, 1)
  view.value = { year: dt.getFullYear(), month: dt.getMonth() }
}
function select(key: string) {
  selected.value = key
  const d = fromDateKey(key)
  if (monthKey(key) !== mk.value) view.value = { year: d.getFullYear(), month: d.getMonth() }
}

const marks = computed(() => {
  const out: Record<string, DayMark[]> = {}
  for (const s of sessions.sessions) {
    ;(out[s.date] ??= []).push({ color: mods.getModality(s.modalityId)?.color ?? '#94a3b8', status: s.status })
  }
  return out
})
const daySessions = computed(() => sessions.byDate(selected.value))
const dayEvals = computed(() => taf.evaluations.filter((e) => e.date === selected.value))
const monthSessions = computed(() => sessions.sessions.filter((s) => monthKey(s.date) === mk.value).sort((a, b) => b.date.localeCompare(a.date)))
const monthTotals = computed(() => ({
  done: monthSessions.value.filter((s) => s.status === 'completed').length,
  skipped: monthSessions.value.filter((s) => s.status === 'skipped').length,
  open: monthSessions.value.filter((s) => s.status === 'in_progress').length
}))
const nameOf = (s: Session) => mods.getModality(s.modalityId)?.name ?? 'Modalidade removida'
const colorOf = (s: Session) => mods.getModality(s.modalityId)?.color ?? '#94a3b8'
/** Outras modalidades concluídas no mesmo dia da sessão (contexto da substituição). */
const sameDay = (s: Session) =>
  sessions.byDate(s.date).filter((o) => o.id !== s.id && o.status === 'completed').map((o) => `${nameOf(o)} · ${o.workoutName}`)
const statusLabel = { completed: 'Concluído', in_progress: 'Em andamento', skipped: 'Não realizado' } as const

function edit(s: Session) {
  void router.push({ name: 'sessao', params: { date: s.date, modalityId: s.modalityId } })
}
async function reopen(s: Session) {
  if (!(await confirmDialog({ title: 'Reabrir este registro?', message: 'Ele deixa de contar na rotação até ser concluído de novo; as próximas sugestões são recalculadas.', confirmText: 'Reabrir' }))) return
  try {
    await sessions.reopen(s.id)
    toast('Registro reaberto.', 'info')
  } catch (e) {
    toastError(e)
  }
}
async function remove(s: Session) {
  const ok = await confirmDialog({
    title: 'Excluir este registro?',
    message: `${nameOf(s)} · ${s.workoutName} em ${formatDM(s.date)} será apagado do histórico e a rotação será recalculada.\n\nUse isto para corrigir um lançamento errado.`,
    confirmText: 'Excluir registro',
    danger: true
  })
  if (!ok) return
  try {
    await sessions.removeSession(s.id)
    toast('Registro excluído. Sugestões recalculadas.')
  } catch (e) {
    toastError(e)
  }
}

const addOpen = ref(false)
const addOptions = computed(() => mods.activeModalities.filter((m) => !sessions.get(selected.value, m.id) || sessions.get(selected.value, m.id)?.status === 'skipped'))
async function add(m: Modality) {
  addOpen.value = false
  try {
    const s = await sessions.start(selected.value, m)
    if (!s) return toast('Esta modalidade não tem treino cadastrado.', 'error')
    edit(s)
  } catch (e) {
    toastError(e)
  }
}
</script>

<template>
  <div class="space-y-5">
    <header>
      <h1 class="h-page">Histórico</h1>
      <p class="muted mt-1">Toque em um dia para ver ou corrigir. Ao corrigir, a rotação é recalculada a partir dos treinos concluídos, em ordem cronológica.</p>
    </header>

    <section class="card">
      <CalendarMonth :year="view.year" :month="view.month" :selected="selected" :marks="marks" @select="select" @nav="nav" />
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-lg font-bold">{{ formatLong(selected) }}</h2>
        <button class="btn-soft" :disabled="!addOptions.length" @click="addOpen = true"><Plus :size="16" /> Registro</button>
      </div>

      <p v-if="!daySessions.length && !dayEvals.length" class="muted rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">Nenhum registro neste dia.</p>

      <article v-for="s in daySessions" :key="s.id" class="card !p-0 overflow-hidden" :style="{ borderLeft: `5px solid ${colorOf(s)}` }">
        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs font-bold uppercase tracking-wide" :style="{ color: colorOf(s) }">{{ nameOf(s) }}</p>
              <h3 class="text-lg font-bold">{{ s.workoutName }}</h3>
              <p v-if="s.substituted" class="muted">Substituição (sugerido: {{ mods.getWorkout(s.suggestedWorkoutId ?? '')?.name ?? '—' }})</p>
              <p v-if="s.replacesModalityId" class="mt-1 inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                <House :size="12" /> Substituiu {{ mods.getModality(s.replacesModalityId)?.name ?? 'Musculação' }}<span v-if="s.replacesWorkoutName"> · programado: {{ s.replacesWorkoutName }}</span>
              </p>
              <p v-if="s.replacesModalityId && sameDay(s).length" class="muted mt-1">No mesmo dia: {{ sameDay(s).join(', ') }}</p>
            </div>
            <span
              class="badge shrink-0"
              :class="s.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : s.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'"
            >{{ statusLabel[s.status] }}</span>
          </div>
          <p v-if="s.durationSec" class="muted mt-1">Duração: {{ formatDuration(s.durationSec) }}</p>
          <ul v-if="s.status !== 'skipped' && s.exercises.length" class="mt-3 space-y-2">
            <li v-for="e in s.exercises" :key="e.exerciseId" class="text-sm">
              <p class="font-semibold">{{ e.name }}<span v-if="mods.getModality(s.modalityId)?.logType !== 'sets' && e.done" class="ml-1 text-emerald-600">✓</span></p>
              <p v-if="e.sets.length" class="muted tabular-nums">
                <span v-for="st in e.sets" :key="st.n" class="mr-3 inline-block" :class="st.done ? '' : 'opacity-40'">
                  {{ st.n }}: {{ st.load ?? '—' }}{{ st.load !== null ? e.unit : '' }} × {{ st.reps ?? '—' }}
                </span>
              </p>
            </li>
          </ul>
          <p v-if="s.notes" class="mt-2 rounded-lg bg-slate-50 p-2 text-sm italic dark:bg-slate-800/60">{{ s.notes }}</p>
        </div>
        <div class="flex items-center gap-1 border-t border-slate-100 px-2 py-1 dark:border-slate-800">
          <button class="btn-ghost" @click="edit(s)"><Pencil :size="16" /> {{ s.status === 'skipped' ? 'Registrar treino' : 'Editar' }}</button>
          <button v-if="s.status === 'completed'" class="btn-ghost" @click="reopen(s)"><RotateCcw :size="16" /> Reabrir</button>
          <span class="flex-1" />
          <button class="icon-btn text-red-500" aria-label="Excluir registro" @click="remove(s)"><Trash2 :size="18" /></button>
        </div>
      </article>

      <article v-for="e in dayEvals" :key="e.id" class="card">
        <p class="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">TAF · {{ e.kind === 'simulated' ? 'Simulado' : 'Treino' }}</p>
        <p class="font-bold">{{ taf.getTest(e.testId)?.name ?? 'Prova removida' }}: {{ e.result }} {{ e.unit }}</p>
        <p v-if="e.notes" class="muted">{{ e.notes }}</p>
      </article>
    </section>

    <section class="card">
      <h2 class="font-bold">Sessões do mês</h2>
      <p class="muted mt-1">{{ monthTotals.done }} concluída(s) · {{ monthTotals.open }} em andamento · {{ monthTotals.skipped }} não realizada(s)</p>
      <ul v-if="monthSessions.length" class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="s in monthSessions" :key="s.id">
          <button class="flex w-full items-center gap-3 py-2.5 text-left" @click="select(s.date)">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: colorOf(s), opacity: s.status === 'skipped' ? 0.3 : 1 }" />
            <span class="w-12 shrink-0 text-sm tabular-nums text-slate-500">{{ formatDM(s.date) }}</span>
            <span class="min-w-0 flex-1 truncate text-sm"><strong>{{ nameOf(s) }}</strong> · {{ s.workoutName }}</span>
            <span class="text-xs text-slate-500">{{ statusLabel[s.status] }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="muted mt-2">Sem sessões neste mês.</p>
    </section>

    <AppModal :open="addOpen" :title="`Registrar em ${formatDM(selected)}`" @close="addOpen = false">
      <p class="muted mb-3">Cria o registro com o treino que a rotação indica para esse dia. Você pode trocá-lo na tela seguinte.</p>
      <ul class="space-y-2">
        <li v-for="m in addOptions" :key="m.id">
          <button class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" @click="add(m)">
            <span class="h-3 w-3 rounded-full" :style="{ background: m.color }" /> {{ m.name }}
          </button>
        </li>
      </ul>
    </AppModal>
  </div>
</template>
