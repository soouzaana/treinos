<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Pencil, Plus, Power, Trash2 } from 'lucide-vue-next'
import { useModalitiesStore } from '@/stores/modalities'
import { useSessionsStore } from '@/stores/sessions'
import type { Workout } from '@/types'
import EmptyState from '@/components/EmptyState.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { toast, toastError } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const mods = useModalitiesStore()
const sessions = useSessionsStore()

const id = computed(() => String(route.params.modalityId))
const modality = computed(() => mods.getModality(id.value))
const list = computed(() => mods.workoutsOf(id.value))
const next = computed(() => sessions.nextFor(id.value))
const lastDone = computed(() => {
  const done = sessions.sessions.filter((s) => s.modalityId === id.value && s.status === 'completed').sort((a, b) => (a.date + (a.completedAt ?? 0)).localeCompare(b.date + (b.completedAt ?? 0)))
  return done[done.length - 1]
})

async function run(fn: () => Promise<unknown>, ok?: string) {
  try {
    await fn()
    if (ok) toast(ok)
  } catch (e) {
    toastError(e)
  }
}
async function remove(w: Workout) {
  const used = sessions.sessions.filter((s) => s.workoutId === w.id).length
  const yes = await confirmDialog({
    title: `Excluir "${w.name}"?`,
    message: `${used ? `Ele aparece em ${used} registro(s) do histórico, que são preservados.\n\n` : ''}Para só tirá-lo da rotação sem apagar, use desativar.`,
    confirmText: 'Excluir',
    danger: true
  })
  if (yes) await run(() => mods.deleteWorkout(w.id), 'Treino excluído.')
}
</script>

<template>
  <div v-if="modality" class="space-y-5">
    <header>
      <RouterLink to="/treinos" class="btn-ghost -ml-3"><ArrowLeft :size="18" /> Treinos</RouterLink>
      <div class="mt-1 flex items-center gap-3">
        <span class="h-4 w-4 rounded-full" :style="{ background: modality.color }" />
        <h1 class="h-page">{{ modality.name }}</h1>
      </div>
      <p class="muted mt-1">Sequência de rotação: a ordem abaixo se repete em ciclo. Só treinos concluídos avançam.</p>
      <p v-if="next" class="mt-2 text-sm"><span class="badge bg-brand-100 text-brand-700 dark:bg-brand-600/30 dark:text-brand-100">Próximo: {{ next.name }}</span><span v-if="lastDone" class="muted ml-2">último concluído: {{ lastDone.workoutName }}</span></p>
    </header>

    <EmptyState v-if="!list.length" title="Nenhum treino nesta modalidade" text="Crie os treinos na ordem em que devem se alternar (ex.: Upper A, Upper B, Lower A…).">
      <button class="btn-primary" @click="router.push(`/treinos/${id}/novo`)"><Plus :size="18" /> Novo treino</button>
    </EmptyState>

    <ol class="space-y-3">
      <li v-for="(w, i) in list" :key="w.id" class="card !p-0 overflow-hidden" :class="w.active ? '' : 'opacity-60'">
        <RouterLink :to="`/treinos/${id}/${w.id}`" class="flex items-center gap-3 p-4">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold dark:bg-slate-800">{{ i + 1 }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-bold">{{ w.name }}
              <span v-if="next?.id === w.id" class="badge ml-1 bg-brand-100 text-brand-700 dark:bg-brand-600/30 dark:text-brand-100">próximo</span>
              <span v-if="!w.active" class="badge ml-1 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">inativo</span>
            </p>
            <p class="muted truncate">{{ w.exercises.length }} {{ w.exercises.length === 1 ? 'item' : 'itens' }}<template v-if="w.description"> · {{ w.description }}</template></p>
          </div>
        </RouterLink>
        <div class="flex items-center gap-0.5 border-t border-slate-100 px-2 py-1 dark:border-slate-800">
          <button class="icon-btn" :disabled="i === 0" aria-label="Subir na sequência" @click="run(() => mods.moveWorkout(w.id, -1))"><ArrowUp :size="18" /></button>
          <button class="icon-btn" :disabled="i === list.length - 1" aria-label="Descer na sequência" @click="run(() => mods.moveWorkout(w.id, 1))"><ArrowDown :size="18" /></button>
          <button class="icon-btn" :aria-label="w.active ? 'Desativar' : 'Ativar'" :title="w.active ? 'Desativar (sai da rotação)' : 'Ativar'" @click="run(() => mods.setWorkoutActive(w.id, !w.active))"><Power :size="18" :class="w.active ? 'text-emerald-500' : ''" /></button>
          <span class="flex-1" />
          <button class="icon-btn" aria-label="Duplicar" @click="run(() => mods.duplicateWorkout(w.id), 'Treino duplicado.')"><Copy :size="18" /></button>
          <button class="icon-btn" aria-label="Editar" @click="router.push(`/treinos/${id}/${w.id}`)"><Pencil :size="18" /></button>
          <button class="icon-btn text-red-500" aria-label="Excluir" @click="remove(w)"><Trash2 :size="18" /></button>
        </div>
      </li>
    </ol>
    <button v-if="list.length" class="btn-primary w-full" @click="router.push(`/treinos/${id}/novo`)"><Plus :size="18" /> Novo treino</button>
  </div>
  <EmptyState v-else title="Modalidade não encontrada"><RouterLink to="/treinos" class="btn-primary">Voltar</RouterLink></EmptyState>
</template>
