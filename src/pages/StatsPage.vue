<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import { Minus, TrendingDown, TrendingUp } from 'lucide-vue-next'
import { useModalitiesStore } from '@/stores/modalities'
import { usePlanStore } from '@/stores/plan'
import { useSessionsStore } from '@/stores/sessions'
import { useTafStore } from '@/stores/taf'
import { compareLastTwo, exerciseHistory, exerciseIndex } from '@/services/progression'
import { countCompleted, currentStreak, rangeStats } from '@/services/stats'
import { personalStatus, sortedEvals, STATUS_LABEL } from '@/services/taf'
import { addDays, formatDM, startOfWeek, toDateKey } from '@/utils/date'
import LineChart from '@/components/LineChart.vue'
import BarChart from '@/components/BarChart.vue'
import EmptyState from '@/components/EmptyState.vue'

const mods = useModalitiesStore()
const plan = usePlanStore()
const sessions = useSessionsStore()
const taf = useTafStore()

const today = toDateKey()
const wk = startOfWeek(today)
const monthStart = today.slice(0, 8) + '01'
const monthEnd = (() => {
  const [y, m] = today.split('-').map(Number)
  return toDateKey(new Date(y, m, 0))
})()

const stats = (from: string, to: string, mid?: string) => rangeStats(from, to, today, plan.days, mods.modalities, sessions.sessions, mid, sessions.swaps)
const week = computed(() => stats(wk, addDays(wk, 6)))
const month = computed(() => stats(monthStart, monthEnd))

const perModality = computed(() =>
  mods.activeModalities.map((m) => {
    const seq = mods.workoutsOf(m.id).filter((w) => w.active)
    const next = sessions.nextFor(m.id)
    return {
      m,
      total: countCompleted(sessions.sessions, m.id),
      last30: stats(addDays(today, -29), today, m.id),
      month: stats(monthStart, monthEnd, m.id),
      streak: currentStreak(m.id, today, plan.days, sessions.sessions, 400, sessions.swaps),
      next,
      pos: next ? seq.findIndex((w) => w.id === next.id) + 1 : 0,
      seqLen: seq.length
    }
  })
)

const weeks = computed(() =>
  Array.from({ length: 8 }, (_, i) => {
    const s = addDays(wk, -7 * (7 - i))
    return { label: formatDM(s), rate: stats(s, addDays(s, 6)).rate }
  })
)
const hasAnyWeek = computed(() => weeks.value.some((w) => w.rate !== null))

// ---- evolução de exercícios
const index = computed(() => exerciseIndex(sessions.sessions))
const sel = ref('')
watchEffect(() => {
  if (!index.value.some((e) => e.key === sel.value)) sel.value = [...index.value].sort((a, b) => b.lastDate.localeCompare(a.lastDate))[0]?.key ?? ''
})
const hist = computed(() => (sel.value ? exerciseHistory(sessions.sessions, sel.value) : []))
const cmp = computed(() => compareLastTwo(hist.value))
const labels = computed(() => hist.value.map((h) => formatDM(h.date)))
const unit = computed(() => hist.value[hist.value.length - 1]?.unit ?? 'kg')
const selName = computed(() => index.value.find((e) => e.key === sel.value)?.name ?? '')

// ---- TAF
const tafRows = computed(() =>
  taf.tests.filter((t) => t.active).map((t) => {
    const list = sortedEvals(taf.evaluations, t.id)
    return { t, status: personalStatus(t, list), last: list[list.length - 1] }
  })
)
const goals = computed(() => ({
  achieved: tafRows.value.filter((r) => r.status === 'achieved').length,
  pending: tafRows.value.filter((r) => r.status === 'progress' || r.status === 'below').length
}))
const statusColor = {
  achieved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  below: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
  nogoal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
} as const
const evoBadge = {
  evolucao: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  regressao: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
  manutencao: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
} as const
const evoLabel = { evolucao: 'Evolução', regressao: 'Regressão', manutencao: 'Manutenção' } as const
</script>

<template>
  <div class="space-y-5">
    <header>
      <h1 class="h-page">Desempenho</h1>
      <p class="muted mt-1">Tudo calculado a partir dos seus registros. “Previsto” usa o planejamento semanal atual.</p>
    </header>

    <section class="grid grid-cols-2 gap-3">
      <article v-for="(p, title) in { 'Esta semana': week, 'Este mês': month }" :key="title" class="card">
        <h2 class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ title }}</h2>
        <p class="mt-1 text-3xl font-extrabold tabular-nums">{{ p.rate === null ? '—' : `${p.rate}%` }}</p>
        <p class="muted">taxa de conclusão</p>
        <dl class="mt-3 space-y-1 text-sm">
          <div class="flex justify-between"><dt class="text-slate-500">Previstos</dt><dd class="font-semibold tabular-nums">{{ p.planned }}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Concluídos</dt><dd class="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{{ p.completed }}<template v-if="p.extra"> (+{{ p.extra }})</template></dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Iniciados</dt><dd class="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{{ p.started }}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Não realizados</dt><dd class="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{{ p.skipped + p.notDone }}</dd></div>
        </dl>
      </article>
    </section>

    <section class="card">
      <h2 class="font-bold">Consistência semanal</h2>
      <p class="muted">Taxa de conclusão das últimas 8 semanas (a barra mais à direita é a semana atual).</p>
      <BarChart v-if="hasAnyWeek" class="mt-2" :labels="weeks.map((w) => w.label)" :values="weeks.map((w) => w.rate)" />
      <p v-else class="muted mt-3">Configure o planejamento e registre treinos para ver o histórico de consistência.</p>
    </section>

    <section class="card">
      <h2 class="font-bold">Por modalidade</h2>
      <EmptyState v-if="!perModality.length" class="mt-3" title="Sem modalidades ativas" />
      <ul v-else class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="r in perModality" :key="r.m.id" class="py-3">
          <p class="flex items-center gap-2 font-bold"><span class="h-3 w-3 rounded-full" :style="{ background: r.m.color }" /> {{ r.m.name }}</p>
          <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div><dt class="text-slate-500">Concluídos (total)</dt><dd class="font-semibold tabular-nums">{{ r.total }}</dd></div>
            <div><dt class="text-slate-500">Últimos 30 dias</dt><dd class="font-semibold tabular-nums">{{ r.last30.completed + r.last30.extra }} <span class="font-normal text-slate-400">de {{ r.last30.planned }} prev.</span></dd></div>
            <div><dt class="text-slate-500">Sequência (dias prev.)</dt><dd class="font-semibold tabular-nums">{{ r.streak }}</dd></div>
            <div><dt class="text-slate-500">Mês</dt><dd class="font-semibold tabular-nums">{{ r.month.rate === null ? '—' : `${r.month.rate}%` }}</dd></div>
          </dl>
          <p class="muted mt-1">Rotação: próximo <strong class="text-slate-700 dark:text-slate-200">{{ r.next?.name ?? '—' }}</strong><template v-if="r.seqLen"> ({{ r.pos }}/{{ r.seqLen }})</template></p>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2 class="font-bold">Evolução dos exercícios</h2>
      <p v-if="!index.length" class="muted mt-2">Conclua treinos com séries registradas (carga e repetições) para acompanhar a evolução.</p>
      <template v-else>
        <label class="label mt-3" for="ex-sel">Exercício</label>
        <select id="ex-sel" v-model="sel" class="input">
          <option v-for="e in index" :key="e.key" :value="e.key">{{ e.name }} ({{ e.sessions }})</option>
        </select>

        <div v-if="cmp" class="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold">Última sessão vs. anterior</p>
            <span class="badge" :class="evoBadge[cmp.evolution]">
              <TrendingUp v-if="cmp.evolution === 'evolucao'" :size="12" /><TrendingDown v-else-if="cmp.evolution === 'regressao'" :size="12" /><Minus v-else :size="12" />
              {{ evoLabel[cmp.evolution] }}
            </span>
          </div>
          <table class="mt-2 w-full text-sm tabular-nums">
            <thead><tr class="text-left text-xs uppercase text-slate-400"><th class="py-1 font-semibold" /><th class="font-semibold">Anterior<br /><span class="font-normal normal-case">{{ formatDM(cmp.previous.date) }}</span></th><th class="font-semibold">Atual<br /><span class="font-normal normal-case">{{ formatDM(cmp.current.date) }}</span></th></tr></thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr><td class="py-1.5 text-slate-500">Carga máx.</td><td>{{ cmp.previous.maxLoad }} {{ unit }}</td><td class="font-semibold">{{ cmp.current.maxLoad }} {{ unit }}</td></tr>
              <tr><td class="py-1.5 text-slate-500">Reps na carga máx.</td><td>{{ cmp.previous.repsAtMaxLoad }}</td><td class="font-semibold">{{ cmp.current.repsAtMaxLoad }}</td></tr>
              <tr><td class="py-1.5 text-slate-500">Séries concluídas</td><td>{{ cmp.previous.doneSets }}</td><td class="font-semibold">{{ cmp.current.doneSets }}</td></tr>
              <tr><td class="py-1.5 text-slate-500">Total de reps</td><td>{{ cmp.previous.totalReps }}</td><td class="font-semibold">{{ cmp.current.totalReps }}</td></tr>
              <tr><td class="py-1.5 text-slate-500">Volume (complementar)</td><td>{{ Math.round(cmp.previous.volume) }}</td><td class="font-semibold">{{ Math.round(cmp.current.volume) }}</td></tr>
            </tbody>
          </table>
          <ul class="mt-2 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300"><li v-for="r in cmp.reasons" :key="r">{{ r }}</li></ul>
        </div>
        <p v-else class="muted mt-3">São necessárias pelo menos 2 sessões de “{{ selName }}” para comparar.</p>

        <template v-if="hist.length">
          <h3 class="mt-5 text-sm font-bold">Carga ({{ unit }})</h3>
          <LineChart :labels="labels" :unit="unit" :series="[{ name: 'Carga máxima', color: '#6366f1', values: hist.map((h) => h.maxLoad) }, { name: 'Carga média', color: '#06b6d4', dashed: true, values: hist.map((h) => Math.round(h.avgLoad * 10) / 10) }]" />
          <h3 class="mt-4 text-sm font-bold">Repetições</h3>
          <LineChart :labels="labels" unit="reps" :series="[{ name: 'Reps na carga máx.', color: '#10b981', values: hist.map((h) => h.repsAtMaxLoad) }, { name: 'Total de reps', color: '#f59e0b', dashed: true, values: hist.map((h) => h.totalReps) }]" />
          <details class="mt-3">
            <summary class="cursor-pointer text-sm font-semibold text-brand-600">Histórico completo ({{ hist.length }})</summary>
            <table class="mt-2 w-full text-sm tabular-nums">
              <thead><tr class="text-left text-xs uppercase text-slate-400"><th class="py-1">Data</th><th>Séries</th><th>Máx.</th><th>Reps</th></tr></thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="h in [...hist].reverse()" :key="h.sessionId"><td class="py-1.5">{{ formatDM(h.date) }}</td><td>{{ h.doneSets }}</td><td>{{ h.maxLoad }} {{ h.unit }}</td><td>{{ h.totalReps }}</td></tr>
              </tbody>
            </table>
          </details>
        </template>
      </template>
    </section>

    <section class="card">
      <div class="flex items-center justify-between">
        <h2 class="font-bold">Provas do TAF</h2>
        <RouterLink to="/taf" class="text-sm font-semibold text-brand-600">Abrir TAF</RouterLink>
      </div>
      <p v-if="!tafRows.length" class="muted mt-2">Nenhuma prova cadastrada.</p>
      <template v-else>
        <p class="muted mt-1">Metas pessoais atingidas: <strong>{{ goals.achieved }}</strong> · pendentes: <strong>{{ goals.pending }}</strong></p>
        <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="r in tafRows" :key="r.t.id" class="flex items-center justify-between gap-2 py-2.5">
            <span class="min-w-0"><span class="block truncate font-medium">{{ r.t.name }}</span><span class="muted">{{ r.last ? `${r.last.result} ${r.t.unit}` : 'sem avaliação' }}<template v-if="r.t.personalGoal !== null"> · meta {{ r.t.personalGoal }}</template></span></span>
            <span class="badge shrink-0" :class="statusColor[r.status]">{{ STATUS_LABEL[r.status] }}</span>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
