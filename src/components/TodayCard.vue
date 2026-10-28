<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRightLeft, Check, ChevronDown, ChevronUp, House, Pencil, Play, RotateCcw, Undo2, Undo, X } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import type { Modality, Session, Workout } from '@/types'
import { formatDuration } from '@/utils/date'

const props = defineProps<{
  modality: Modality
  session?: Session
  workout: Workout | null
  suggested: Workout | null
  next: Workout | null
  planned: boolean
  /** quando esta modalidade substitui outra no dia (ex.: Treino em Casa no lugar da Musculação) */
  swapInfo?: { modalityName: string; workoutName: string | null } | null
  /** mostra o atalho "Substituir por treino em casa" (musculação prevista e ainda sem registro) */
  canSubstitute?: boolean
  /** mostra "Voltar para musculação" (substituição ainda cancelável) */
  canCancelSwap?: boolean
}>()
const emit = defineEmits<{
  start: []
  complete: []
  skip: []
  undoSkip: []
  reopen: []
  edit: []
  swap: []
  substitute: []
  cancelSwap: []
}>()

const status = computed(() => props.session?.status ?? 'pending')
const open = ref(false)
const showList = computed(() => open.value || status.value === 'pending' || status.value === 'in_progress')
const substituted = computed(() => !!props.workout && !!props.suggested && props.workout.id !== props.suggested.id)
const label = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluído', skipped: 'Não realizado' } as const
const badge = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  skipped: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
} as const
const exercises = computed(() => props.workout?.exercises ?? [])
</script>

<template>
  <article class="card overflow-hidden !p-0" :style="{ borderLeft: `5px solid ${modality.color}` }">
    <div class="p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wide" :style="{ color: modality.color }">
            {{ modality.name }}<span v-if="!planned" class="ml-1 text-slate-400">· extra</span>
          </p>
          <h3 class="mt-0.5 truncate text-xl font-bold">{{ workout?.name ?? session?.workoutName ?? 'Sem treino cadastrado' }}</h3>
          <p v-if="substituted || session?.substituted" class="mt-1 inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
            <ArrowRightLeft :size="12" /> Substituição<span v-if="suggested"> (sugerido: {{ suggested.name }})</span>
          </p>
        </div>
        <span class="badge shrink-0" :class="badge[status]">{{ label[status] }}</span>
      </div>
      <p v-if="swapInfo" class="mt-2 inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
        <House :size="12" /> Substitui {{ swapInfo.modalityName }}<span v-if="swapInfo.workoutName"> · {{ swapInfo.workoutName }}</span>
      </p>

      <p v-if="workout?.description" class="muted mt-1">{{ workout.description }}</p>
      <p v-if="workout?.goal" class="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">Meta: {{ workout.goal }}</p>
      <p v-if="session?.durationSec" class="muted mt-1">Duração: {{ formatDuration(session.durationSec) }}</p>

      <ul v-if="showList && exercises.length" class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="e in exercises" :key="e.id" class="py-2">
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-medium">{{ e.name }}</span>
            <span class="shrink-0 text-sm tabular-nums text-slate-500 dark:text-slate-400">
              <template v-if="modality.logType === 'sets'">{{ e.sets }}×{{ e.reps }}<template v-if="e.load !== null"> · {{ e.load }} {{ e.unit }}</template><template v-if="e.durationSec"> · {{ e.durationSec }} s</template><template v-if="e.restSec"> · desc. {{ e.restSec }} s</template></template>
              <template v-else>{{ e.reps }}</template>
            </span>
          </div>
          <p v-if="e.notes" class="muted mt-0.5">{{ e.notes }}</p>
        </li>
      </ul>
      <button v-else-if="exercises.length" class="btn-ghost mt-2 -ml-2" @click="open = true"><ChevronDown :size="16" /> Ver {{ exercises.length }} itens</button>
      <button v-if="open && status !== 'pending' && status !== 'in_progress'" class="btn-ghost -ml-2" @click="open = false"><ChevronUp :size="16" /> Recolher</button>
      <p v-if="workout && !exercises.length" class="muted mt-2">Este treino ainda não tem exercícios cadastrados. <RouterLink class="font-semibold text-brand-600 underline dark:text-brand-100" :to="`/treinos/${modality.id}/${workout.id}`">Preencher agora</RouterLink></p>
      <p v-if="workout?.notes" class="muted mt-2 italic">{{ workout.notes }}</p>
      <p v-if="next" class="muted mt-3">Próximo da rotação: <strong class="text-slate-700 dark:text-slate-200">{{ next.name }}</strong></p>
    </div>

    <div class="border-t border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div v-if="status === 'pending'" class="grid grid-cols-2 gap-2">
        <button class="btn-primary" :disabled="!workout" @click="emit('start')"><Play :size="18" /> Iniciar treino</button>
        <button class="btn-soft !text-emerald-700 dark:!text-emerald-300" :disabled="!workout" @click="emit('complete')"><Check :size="18" /> Concluir {{ modality.name.toLowerCase() }}</button>
        <button class="btn-ghost" :disabled="!workout && !suggested" @click="emit('swap')"><ArrowRightLeft :size="16" /> Trocar treino</button>
        <button class="btn-ghost" @click="emit('skip')"><X :size="16" /> Não treinei</button>
        <button v-if="canSubstitute" class="btn-soft col-span-2 !text-violet-700 dark:!text-violet-200" @click="emit('substitute')"><House :size="18" /> Substituir por treino em casa</button>
        <button v-if="canCancelSwap" class="btn-ghost col-span-2" @click="emit('cancelSwap')"><Undo :size="16" /> Voltar para {{ (swapInfo?.modalityName ?? 'musculação').toLowerCase() }}</button>
      </div>
      <div v-else-if="status === 'in_progress'" class="grid grid-cols-2 gap-2">
        <button class="btn-primary" @click="emit('start')"><Play :size="18" /> Retomar</button>
        <button class="btn-soft !text-emerald-700 dark:!text-emerald-300" @click="emit('complete')"><Check :size="18" /> Concluir {{ modality.name.toLowerCase() }}</button>
        <button class="btn-ghost" @click="emit('swap')"><ArrowRightLeft :size="16" /> Trocar treino</button>
        <button class="btn-ghost" @click="emit('skip')"><X :size="16" /> Não treinei</button>
        <button v-if="canCancelSwap" class="btn-ghost col-span-2" @click="emit('cancelSwap')"><Undo :size="16" /> Cancelar substituição</button>
      </div>
      <div v-else-if="status === 'completed'" class="grid grid-cols-2 gap-2">
        <button class="btn-soft" @click="emit('edit')"><Pencil :size="16" /> Ver / editar registro</button>
        <button class="btn-ghost" @click="emit('reopen')"><RotateCcw :size="16" /> Reabrir (corrigir)</button>
      </div>
      <div v-else class="grid grid-cols-2 gap-2">
        <button class="btn-soft" @click="emit('undoSkip')"><Undo2 :size="16" /> Desfazer</button>
        <button class="btn-primary" :disabled="!suggested" @click="emit('start')"><Play :size="18" /> Treinei, registrar</button>
        <button v-if="canCancelSwap" class="btn-ghost col-span-2" @click="emit('cancelSwap')"><Undo :size="16" /> Voltar para {{ (swapInfo?.modalityName ?? 'musculação').toLowerCase() }}</button>
      </div>
    </div>
  </article>
</template>
