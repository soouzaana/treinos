<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowDown, ArrowUp, BedDouble, Plus, X } from 'lucide-vue-next'
import { useModalitiesStore } from '@/stores/modalities'
import { usePlanStore } from '@/stores/plan'
import { useSessionsStore } from '@/stores/sessions'
import { projectDays } from '@/services/projection'
import { formatDM, toDateKey, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/utils/date'
import AppModal from '@/components/AppModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import { toastError } from '@/composables/useToast'

const mods = useModalitiesStore()
const plan = usePlanStore()
const sessions = useSessionsStore()

const order = [1, 2, 3, 4, 5, 6, 0] // semana começa na segunda
const today = toDateKey()
const todayWd = new Date().getDay()

const projection = computed(() => projectDays(today, 7, plan.days, mods.modalities, mods.workouts, sessions.sessions))
const projOf = (weekday: number) => projection.value.find((p) => p.weekday === weekday)

async function run(fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e) {
    toastError(e)
  }
}

const addFor = ref<number | null>(null)
const options = computed(() =>
  addFor.value === null ? [] : mods.activeModalities.filter((m) => !plan.dayOf(addFor.value!).modalityIds.includes(m.id))
)
function add(id: string) {
  const wd = addFor.value!
  addFor.value = null
  void run(() => plan.addModality(wd, id))
}
</script>

<template>
  <div class="space-y-5">
    <header>
      <h1 class="h-page">Planejamento semanal</h1>
      <p class="muted mt-1">Defina quais modalidades entram em cada dia. O treino de cada uma vem da própria rotação — não fica preso a um dia da semana. Alterar o plano nunca reinicia sequências nem apaga histórico.</p>
    </header>

    <EmptyState v-if="!mods.activeModalities.length" title="Nenhuma modalidade ativa" text="Cadastre modalidades antes de montar a semana.">
      <RouterLink to="/treinos" class="btn-primary">Ir para Treinos</RouterLink>
    </EmptyState>

    <template v-else>
      <article v-for="wd in order" :key="wd" class="card" :class="wd === todayWd ? 'ring-2 ring-brand-500/60' : ''">
        <header class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-bold">{{ WEEKDAYS_LONG[wd] }} <span v-if="wd === todayWd" class="badge ml-1 bg-brand-100 text-brand-700 dark:bg-brand-600/30 dark:text-brand-100">hoje</span></h2>
          <label class="flex min-h-[44px] items-center gap-2 text-sm font-medium">
            <input type="checkbox" class="h-5 w-5 rounded accent-brand-600" :checked="plan.dayOf(wd).rest" @change="run(() => plan.setRest(wd, ($event.target as HTMLInputElement).checked))" />
            <BedDouble :size="16" /> Descanso
          </label>
        </header>

        <p v-if="plan.dayOf(wd).rest" class="muted mt-1">Dia de descanso.</p>
        <template v-else>
          <ul v-if="plan.dayOf(wd).modalityIds.length" class="mt-2 space-y-2">
            <li
              v-for="(id, idx) in plan.dayOf(wd).modalityIds" :key="id"
              class="flex items-center gap-1 rounded-xl border border-slate-200 py-1 pl-3 pr-1 dark:border-slate-700"
            >
              <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: mods.getModality(id)?.color ?? '#94a3b8' }" />
              <div class="ml-1 min-w-0 flex-1">
                <p class="truncate font-semibold" :class="mods.getModality(id)?.active ? '' : 'opacity-50 line-through'">{{ mods.getModality(id)?.name ?? 'Modalidade removida' }}</p>
                <p class="muted truncate">
                  Próximo:
                  <strong class="text-slate-700 dark:text-slate-200">{{ projOf(wd)?.items.find((i) => i.modalityId === id)?.workoutName ?? sessions.nextFor(id)?.name ?? '—' }}</strong>
                </p>
              </div>
              <button class="icon-btn !h-10 !w-10" :disabled="idx === 0" aria-label="Mover para cima" @click="run(() => plan.moveModality(wd, id, -1))"><ArrowUp :size="16" /></button>
              <button class="icon-btn !h-10 !w-10" :disabled="idx === plan.dayOf(wd).modalityIds.length - 1" aria-label="Mover para baixo" @click="run(() => plan.moveModality(wd, id, 1))"><ArrowDown :size="16" /></button>
              <button class="icon-btn !h-10 !w-10" aria-label="Remover do dia" @click="run(() => plan.removeModality(wd, id))"><X :size="16" /></button>
            </li>
          </ul>
          <p v-else class="muted mt-1">Nenhuma modalidade prevista.</p>
          <button class="btn-soft mt-3" :disabled="!mods.activeModalities.some((m) => !plan.dayOf(wd).modalityIds.includes(m.id))" @click="addFor = wd"><Plus :size="16" /> Adicionar modalidade</button>
        </template>
      </article>

      <section class="card">
        <h2 class="font-bold">Projeção dos próximos 7 dias</h2>
        <p class="muted mt-1">Se você concluir tudo em ordem, estes serão os treinos sugeridos. É só uma prévia: nada é gravado e a rotação real depende do que você concluir.</p>
        <ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="p in projection" :key="p.date" class="flex gap-3 py-2.5">
            <span class="w-16 shrink-0 text-sm font-semibold">{{ WEEKDAYS_SHORT[p.weekday] }} <span class="font-normal text-slate-400">{{ formatDM(p.date) }}</span></span>
            <span v-if="p.rest" class="muted">Descanso</span>
            <span v-else-if="!p.items.length" class="muted">—</span>
            <span v-else class="flex flex-1 flex-wrap gap-x-4 gap-y-1">
              <span v-for="i in p.items" :key="i.modalityId" class="text-sm">
                <span class="font-semibold">{{ mods.getModality(i.modalityId)?.name }}:</span>
                {{ i.workoutName ?? '—' }}
                <span v-if="i.state !== 'projected'" class="text-xs text-slate-400">({{ i.state === 'completed' ? 'feito' : i.state === 'in_progress' ? 'em andamento' : 'não realizado' }})</span>
              </span>
            </span>
          </li>
        </ul>
      </section>
    </template>

    <AppModal :open="addFor !== null" :title="addFor !== null ? `Adicionar — ${WEEKDAYS_LONG[addFor]}` : ''" @close="addFor = null">
      <ul class="space-y-2">
        <li v-for="m in options" :key="m.id">
          <button class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" @click="add(m.id)">
            <span class="h-3 w-3 rounded-full" :style="{ background: m.color }" /> {{ m.name }}
          </button>
        </li>
      </ul>
    </AppModal>
  </div>
</template>
