<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ArrowDownRight, ArrowUpRight, Minus, Pencil, Plus, Sparkles, Trash2 } from 'lucide-vue-next'
import { useTafStore } from '@/stores/taf'
import type { TafDirection, TafEvalKind, TafEvaluation, TafKind, TafTest } from '@/types'
import { compareWithPrevious, formatPace, meetsTarget, officialStatus, paceMinPerKm, percentOfGoal, personalStatus, sortedEvals, STATUS_LABEL } from '@/services/taf'
import { formatDM, formatShort, toDateKey } from '@/utils/date'
import AppModal from '@/components/AppModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import LineChart from '@/components/LineChart.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { toast, toastError } from '@/composables/useToast'

const taf = useTafStore()
const tab = ref<'painel' | 'registrar' | 'provas'>('painel')
const filter = ref<'all' | TafEvalKind>('all')
const kindLabel: Record<TafEvalKind, string> = { training: 'Treino', simulated: 'Simulado' }

const activeTests = computed(() => taf.tests.filter((t) => t.active))
const rows = computed(() =>
  activeTests.value.map((t) => {
    const list = sortedEvals(taf.evaluations, t.id, filter.value === 'all' ? undefined : filter.value)
    const last = list[list.length - 1]
    const unitKm = t.unit.toLowerCase() === 'km'
    const dist = last && t.kind === 'distance' && (t.unit.toLowerCase() === 'm' || unitKm) ? (unitKm ? last.result * 1000 : last.result) : null
    const dur = last?.durationSec ?? t.durationSec
    return {
      t, list, last,
      status: personalStatus(t, list),
      official: officialStatus(t, list),
      cmp: compareWithPrevious(t, list),
      pct: last ? percentOfGoal(t, last.result, t.personalGoal) : null,
      pace: dist !== null && dur ? paceMinPerKm(dist, dur) : null
    }
  })
)
const officialSummary = computed(() => {
  const withRef = rows.value.filter((r) => r.t.officialRef !== null)
  return { total: withRef.length, evaluated: withRef.filter((r) => r.last).length, meets: withRef.filter((r) => r.official === 'meets').length }
})
const statusColor = {
  achieved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  below: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
  nogoal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
} as const
const barColor = { achieved: 'bg-emerald-500', progress: 'bg-amber-400', below: 'bg-rose-500', nogoal: 'bg-slate-400' } as const

// ---- avaliação
const evalOpen = ref(false)
const editingEval = ref<TafEvaluation | null>(null)
const ef = reactive({ testId: '', date: toDateKey(), result: '' as string | number, kind: 'training' as TafEvalKind, duration: '' as string | number, notes: '', goal: '' as string | number, ref: '' as string | number, source: '' })
const numOrNull = (v: string | number) => (v === '' || v === null || Number.isNaN(Number(v)) ? null : Number(v))
const efTest = computed(() => taf.getTest(ef.testId))

function openEval(e?: TafEvaluation, testId?: string) {
  editingEval.value = e ?? null
  const t = taf.getTest(e?.testId ?? testId ?? activeTests.value[0]?.id ?? '')
  Object.assign(ef, {
    testId: t?.id ?? '',
    date: e?.date ?? toDateKey(),
    result: e?.result ?? '',
    kind: e?.kind ?? 'training',
    duration: e?.durationSec ?? t?.durationSec ?? '',
    notes: e?.notes ?? '',
    goal: e ? e.personalGoal ?? '' : t?.personalGoal ?? '',
    ref: e ? e.officialRef ?? '' : t?.officialRef ?? '',
    source: e ? e.officialSource : t?.officialSource ?? ''
  })
  evalOpen.value = true
}
function onTestChange() {
  const t = efTest.value
  if (!t || editingEval.value) return
  ef.duration = t.durationSec ?? ''
  ef.goal = t.personalGoal ?? ''
  ef.ref = t.officialRef ?? ''
  ef.source = t.officialSource
}
async function saveEval() {
  try {
    const result = numOrNull(ef.result)
    if (result === null) throw new Error('Informe o resultado.')
    // meta/referência digitadas aqui passam a valer para a prova (fonte única do painel);
    // a avaliação guarda um retrato dos valores da época.
    const t = efTest.value
    const goal = numOrNull(ef.goal)
    const ref = numOrNull(ef.ref)
    const source = ef.source.trim()
    if (t && (goal !== t.personalGoal || ref !== t.officialRef || source !== t.officialSource)) {
      await taf.saveTest({ ...t, personalGoal: goal, officialRef: ref, officialSource: source })
    }
    await taf.saveEvaluation({
      id: editingEval.value?.id, testId: ef.testId, date: ef.date, result, kind: ef.kind,
      durationSec: numOrNull(ef.duration), notes: ef.notes.trim(),
      personalGoal: goal, officialRef: ref, officialSource: source
    })
    evalOpen.value = false
    toast('Avaliação registrada.')
  } catch (e) {
    toastError(e)
  }
}
async function removeEval(e: TafEvaluation) {
  if (!(await confirmDialog({ title: 'Excluir avaliação?', message: `${taf.getTest(e.testId)?.name ?? 'Prova'} em ${formatShort(e.date)}: ${e.result} ${e.unit}.`, confirmText: 'Excluir', danger: true }))) return
  try {
    await taf.deleteEvaluation(e.id)
  } catch (err) {
    toastError(err)
  }
}
const allEvals = computed(() => [...taf.evaluations].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)))

// ---- provas
const testOpen = ref(false)
const editingTest = ref<TafTest | null>(null)
const tf = reactive({
  name: '', unit: '', kind: 'reps' as TafKind, direction: 'higher' as TafDirection, duration: '' as string | number,
  protocol: '', goal: '' as string | number, ref: '' as string | number, source: '', active: true
})
function openTest(t?: TafTest) {
  editingTest.value = t ?? null
  Object.assign(tf, {
    name: t?.name ?? '', unit: t?.unit ?? '', kind: t?.kind ?? 'reps', direction: t?.direction ?? 'higher', duration: t?.durationSec ?? '',
    protocol: t?.protocol ?? '', goal: t?.personalGoal ?? '', ref: t?.officialRef ?? '', source: t?.officialSource ?? '', active: t?.active ?? true
  })
  testOpen.value = true
}
async function saveTest() {
  try {
    await taf.saveTest({
      id: editingTest.value?.id, name: tf.name, unit: tf.unit, kind: tf.kind, direction: tf.direction,
      durationSec: numOrNull(tf.duration), protocol: tf.protocol, personalGoal: numOrNull(tf.goal),
      officialRef: numOrNull(tf.ref), officialSource: tf.source, active: tf.active
    })
    testOpen.value = false
    toast('Prova salva.')
  } catch (e) {
    toastError(e)
  }
}
async function removeTest(t: TafTest) {
  const n = taf.evaluations.filter((e) => e.testId === t.id).length
  if (!(await confirmDialog({ title: `Excluir "${t.name}"?`, message: n ? `As ${n} avaliação(ões) desta prova também serão excluídas. Para só ocultar, desative a prova.` : undefined, confirmText: 'Excluir', danger: true }))) return
  try {
    await taf.deleteTest(t.id)
  } catch (e) {
    toastError(e)
  }
}
async function suggested() {
  try {
    await taf.addSuggested()
    toast('Provas sugeridas adicionadas — defina suas metas e as referências do seu edital.')
  } catch (e) {
    toastError(e)
  }
}
const arrow = (improved: boolean | null) => (improved === null ? Minus : improved ? ArrowUpRight : ArrowDownRight)
const fmtN = (n: number) => (Math.round(n * 100) / 100).toString()
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h1 class="h-page">TAF</h1>
        <p class="muted mt-1">Acompanhamento separado da musculação. Metas e critérios são seus — o app não inventa índices oficiais.</p>
      </div>
      <button class="btn-primary shrink-0" :disabled="!activeTests.length" @click="openEval()"><Plus :size="18" /> Avaliação</button>
    </header>

    <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
      <button v-for="[k, l] in [['painel', 'Painel'], ['registrar', 'Histórico'], ['provas', 'Provas']] as const" :key="k" role="tab" :aria-selected="tab === k" class="min-h-[44px] rounded-lg text-sm font-semibold transition" :class="tab === k ? 'bg-white shadow dark:bg-slate-900' : 'text-slate-500'" @click="tab = k">{{ l }}</button>
    </div>

    <!-- PAINEL -->
    <template v-if="tab === 'painel'">
      <EmptyState v-if="!taf.tests.length" title="Nenhuma prova cadastrada" text="Adicione as provas mais comuns e ajuste metas e critérios conforme o seu edital, ou crie as suas.">
        <button class="btn-primary" @click="suggested"><Sparkles :size="16" /> Adicionar 4 provas sugeridas</button>
        <button class="btn-soft" @click="openTest()">Criar prova</button>
      </EmptyState>
      <template v-else>
        <div class="flex gap-2 overflow-x-auto" role="group" aria-label="Tipo de avaliação">
          <button v-for="[k, l] in [['all', 'Todas'], ['training', 'Treino'], ['simulated', 'Simulado']] as const" :key="k" class="btn-soft !min-h-[40px] shrink-0" :class="filter === k ? 'ring-2 ring-brand-500' : ''" :aria-pressed="filter === k" @click="filter = k">{{ l }}</button>
        </div>

        <p v-if="officialSummary.total" class="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          Referências oficiais cadastradas: {{ officialSummary.total }} prova(s) · {{ officialSummary.meets }} atendida(s) na última avaliação ({{ officialSummary.evaluated }} avaliada(s)).
          Isto compara apenas o que você cadastrou — <strong>não indica aprovação</strong>. Confirme todos os critérios no edital.
        </p>

        <article v-for="r in rows" :key="r.t.id" class="card space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h2 class="text-lg font-bold">{{ r.t.name }}</h2>
              <p class="muted">{{ r.t.protocol || '—' }}<template v-if="r.t.durationSec"> · {{ r.t.durationSec }} s</template> · {{ r.t.direction === 'lower' ? 'menor é melhor' : 'maior é melhor' }}</p>
            </div>
            <span class="badge shrink-0" :class="statusColor[r.status]">{{ STATUS_LABEL[r.status] }}</span>
          </div>

          <template v-if="r.last">
            <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p class="text-3xl font-extrabold tabular-nums">{{ fmtN(r.last.result) }} <span class="text-base font-semibold text-slate-500">{{ r.t.unit }}</span></p>
                <p class="muted">{{ formatShort(r.last.date) }} · {{ kindLabel[r.last.kind] }}</p>
              </div>
              <div v-if="r.cmp" class="flex items-center gap-1 text-sm font-semibold" :class="r.cmp.improved === null ? 'text-slate-500' : r.cmp.improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                <component :is="arrow(r.cmp.improved)" :size="18" />
                {{ r.cmp.delta > 0 ? '+' : '' }}{{ fmtN(r.cmp.delta) }} {{ r.t.unit }} <span class="font-normal text-slate-500">vs. {{ formatDM(r.cmp.previous.date) }} ({{ fmtN(r.cmp.previous.result) }})</span>
              </div>
              <div v-else class="muted">Sem avaliação anterior para comparar.</div>
            </div>

            <div v-if="r.t.personalGoal !== null">
              <div class="flex justify-between text-sm"><span class="muted">Meta pessoal: {{ r.t.personalGoal }} {{ r.t.unit }}</span><span class="font-semibold tabular-nums">{{ r.pct === null ? '—' : `${Math.round(r.pct)}%` }}</span></div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full transition-all" :class="barColor[r.status]" :style="{ width: `${Math.min(100, r.pct ?? 0)}%` }" /></div>
            </div>
            <p v-else class="muted">Defina uma meta pessoal em “Provas” para ver o percentual atingido.</p>

            <p v-if="r.pace !== null" class="text-sm">Ritmo médio: <strong>{{ formatPace(r.pace) }}</strong></p>

            <div v-if="r.t.officialRef !== null" class="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p class="font-semibold">Referência cadastrada: {{ r.t.officialRef }} {{ r.t.unit }}<span v-if="r.t.officialSource" class="font-normal text-slate-500"> — {{ r.t.officialSource }}</span></p>
              <p class="mt-0.5" :class="meetsTarget(r.t, r.last.result, r.t.officialRef) ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'">
                Última avaliação {{ meetsTarget(r.t, r.last.result, r.t.officialRef) ? 'atende' : 'não atende' }} a referência cadastrada.
              </p>
            </div>

            <LineChart
              v-if="r.list.length > 1" :labels="r.list.map((e) => formatDM(e.date))" :unit="r.t.unit"
              :series="[{ name: 'Resultado', color: '#6366f1', values: r.list.map((e) => e.result) }]"
              :ref-line="r.t.personalGoal !== null ? { value: r.t.personalGoal, label: 'meta' } : null"
            />
          </template>
          <p v-else class="muted">Sem avaliações{{ filter !== 'all' ? ' deste tipo' : '' }} ainda.</p>

          <button class="btn-soft w-full" @click="openEval(undefined, r.t.id)"><Plus :size="16" /> Registrar avaliação</button>
        </article>
      </template>
    </template>

    <!-- HISTÓRICO -->
    <template v-else-if="tab === 'registrar'">
      <EmptyState v-if="!allEvals.length" title="Nenhuma avaliação registrada" text="Registre avaliações de treino ou simulados para acompanhar a evolução." />
      <ul v-else class="space-y-3">
        <li v-for="e in allEvals" :key="e.id" class="card flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate font-bold">{{ taf.getTest(e.testId)?.name ?? 'Prova removida' }}</p>
            <p class="text-lg font-extrabold tabular-nums">{{ fmtN(e.result) }} <span class="text-sm font-semibold text-slate-500">{{ e.unit }}</span></p>
            <p class="muted">{{ formatShort(e.date) }} · {{ kindLabel[e.kind] }}<template v-if="e.notes"> · {{ e.notes }}</template></p>
          </div>
          <button class="icon-btn" aria-label="Editar" @click="openEval(e)"><Pencil :size="18" /></button>
          <button class="icon-btn text-red-500" aria-label="Excluir" @click="removeEval(e)"><Trash2 :size="18" /></button>
        </li>
      </ul>
    </template>

    <!-- PROVAS -->
    <template v-else>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" @click="openTest()"><Plus :size="16" /> Nova prova</button>
        <button class="btn-soft" @click="suggested"><Sparkles :size="16" /> Adicionar sugeridas</button>
      </div>
      <EmptyState v-if="!taf.tests.length" title="Nenhuma prova" text="Crie provas conforme o edital: nome, unidade, meta e referência oficial." />
      <ul class="space-y-3">
        <li v-for="t in taf.tests" :key="t.id" class="card" :class="t.active ? '' : 'opacity-60'">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-bold">{{ t.name }} <span v-if="!t.active" class="badge ml-1 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">inativa</span></p>
              <p class="muted">{{ t.unit }} · {{ t.direction === 'lower' ? 'menor é melhor' : 'maior é melhor' }}<template v-if="t.personalGoal !== null"> · meta {{ t.personalGoal }}</template><template v-if="t.officialRef !== null"> · ref. {{ t.officialRef }}</template></p>
            </div>
            <div class="flex shrink-0">
              <button class="icon-btn" aria-label="Editar prova" @click="openTest(t)"><Pencil :size="18" /></button>
              <button class="icon-btn text-red-500" aria-label="Excluir prova" @click="removeTest(t)"><Trash2 :size="18" /></button>
            </div>
          </div>
        </li>
      </ul>
    </template>

    <!-- modal avaliação -->
    <AppModal :open="evalOpen" :title="editingEval ? 'Editar avaliação' : 'Nova avaliação'" @close="evalOpen = false">
      <form id="eval-form" class="space-y-4" @submit.prevent="saveEval">
        <div>
          <label class="label" for="e-test">Prova</label>
          <select id="e-test" v-model="ef.testId" class="input" :disabled="!!editingEval" @change="onTestChange">
            <option v-for="t in taf.tests" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="e-date">Data</label><input id="e-date" v-model="ef.date" type="date" class="input" required /></div>
          <div><label class="label" for="e-res">Resultado ({{ efTest?.unit }})</label><input id="e-res" v-model="ef.result" type="number" inputmode="decimal" step="any" min="0" class="input" required /></div>
        </div>
        <div>
          <span class="label">Tipo</span>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="(l, k) in kindLabel" :key="k" type="button" class="btn-soft" :class="ef.kind === k ? 'ring-2 ring-brand-500' : ''" :aria-pressed="ef.kind === k" @click="ef.kind = k">{{ l }}</button>
          </div>
        </div>
        <div><label class="label" for="e-dur">Duração do teste (s) — opcional</label><input id="e-dur" v-model="ef.duration" type="number" inputmode="numeric" min="0" class="input" /></div>
        <p class="muted -mb-2">Meta e referência valem para a prova inteira; alterá-las aqui atualiza a prova.</p>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="e-goal">Meta pessoal</label><input id="e-goal" v-model="ef.goal" type="number" inputmode="decimal" step="any" class="input" /></div>
          <div><label class="label" for="e-ref">Referência oficial</label><input id="e-ref" v-model="ef.ref" type="number" inputmode="decimal" step="any" class="input" /></div>
        </div>
        <div><label class="label" for="e-src">Origem da referência</label><input id="e-src" v-model="ef.source" class="input" placeholder="Ex.: Edital 01/2026, item 8.3" maxlength="120" /></div>
        <div><label class="label" for="e-notes">Observações</label><textarea id="e-notes" v-model="ef.notes" class="input min-h-[64px]" maxlength="300" /></div>
      </form>
      <template #footer>
        <div class="grid grid-cols-2 gap-2"><button class="btn-soft" type="button" @click="evalOpen = false">Cancelar</button><button class="btn-primary" type="submit" form="eval-form">Salvar</button></div>
      </template>
    </AppModal>

    <!-- modal prova -->
    <AppModal :open="testOpen" :title="editingTest ? 'Editar prova' : 'Nova prova'" @close="testOpen = false">
      <form id="test-form" class="space-y-4" @submit.prevent="saveTest">
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2"><label class="label" for="t-name">Nome</label><input id="t-name" v-model="tf.name" class="input" maxlength="50" required /></div>
          <div><label class="label" for="t-unit">Unidade</label><input id="t-unit" v-model="tf.unit" class="input" placeholder="m, rep, s" maxlength="8" required /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="t-kind">Tipo</label>
            <select id="t-kind" v-model="tf.kind" class="input"><option value="distance">Distância</option><option value="reps">Repetições</option><option value="time">Tempo</option><option value="custom">Outro</option></select></div>
          <div><label class="label" for="t-dir">Melhor é</label>
            <select id="t-dir" v-model="tf.direction" class="input"><option value="higher">Maior</option><option value="lower">Menor</option></select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="t-dur">Duração (s)</label><input id="t-dur" v-model="tf.duration" type="number" min="0" inputmode="numeric" class="input" placeholder="720 = 12 min" /></div>
          <div><label class="label" for="t-goal">Meta pessoal</label><input id="t-goal" v-model="tf.goal" type="number" step="any" min="0" inputmode="decimal" class="input" /></div>
        </div>
        <div><label class="label" for="t-proto">Protocolo / método</label><input id="t-proto" v-model="tf.protocol" class="input" placeholder="Como a prova é avaliada" maxlength="140" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="t-ref">Referência oficial</label><input id="t-ref" v-model="tf.ref" type="number" step="any" min="0" inputmode="decimal" class="input" /></div>
          <div><label class="label" for="t-src">Origem</label><input id="t-src" v-model="tf.source" class="input" placeholder="Edital…" maxlength="100" /></div>
        </div>
        <label class="flex min-h-[44px] items-center gap-3 text-sm font-medium"><input v-model="tf.active" type="checkbox" class="h-5 w-5 rounded accent-brand-600" /> Prova ativa</label>
      </form>
      <template #footer>
        <div class="grid grid-cols-2 gap-2"><button class="btn-soft" type="button" @click="testOpen = false">Cancelar</button><button class="btn-primary" type="submit" form="test-form">Salvar</button></div>
      </template>
    </AppModal>
  </div>
</template>
