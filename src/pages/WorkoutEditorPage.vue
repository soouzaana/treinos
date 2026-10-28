<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-vue-next'
import { newExercise, useModalitiesStore } from '@/stores/modalities'
import type { Exercise } from '@/types'
import EmptyState from '@/components/EmptyState.vue'
import { toast, toastError } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const mods = useModalitiesStore()

const modalityId = String(route.params.modalityId)
const workoutId = String(route.params.workoutId)
const modality = computed(() => mods.getModality(modalityId))
const isNew = workoutId === 'novo'
const isSets = computed(() => modality.value?.logType === 'sets')
const found = ref(true)
const saving = ref(false)

const form = reactive({ name: '', description: '', goal: '', notes: '', active: true, exercises: [] as Exercise[] })

onMounted(() => {
  if (isNew) {
    form.exercises = [newExercise({ unit: isSets.value ? 'kg' : '', sets: 1, reps: isSets.value ? '10' : '' })]
    return
  }
  const w = mods.getWorkout(workoutId)
  if (!w || w.modalityId !== modalityId) {
    found.value = false
    return
  }
  Object.assign(form, { name: w.name, description: w.description, goal: w.goal, notes: w.notes, active: w.active, exercises: JSON.parse(JSON.stringify(w.exercises)) })
})

function addEx() {
  form.exercises.push(newExercise({ unit: isSets.value ? 'kg' : '', sets: isSets.value ? 3 : 1, reps: isSets.value ? '10' : '' }))
}
function mv(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= form.exercises.length) return
  ;[form.exercises[i], form.exercises[j]] = [form.exercises[j], form.exercises[i]]
}
/** Campo numérico opcional (segundos): vazio vira null. */
function secInput(e: Exercise, key: 'durationSec' | 'restSec', ev: Event) {
  const v = (ev.target as HTMLInputElement).value.replace(',', '.').trim()
  const n = Number(v)
  e[key] = v === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n)
}
function loadInput(e: Exercise, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.replace(',', '.').trim()
  e.load = v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    await mods.saveWorkout({
      id: isNew ? undefined : workoutId,
      modalityId,
      name: form.name,
      description: form.description,
      goal: form.goal,
      notes: form.notes,
      active: form.active,
      exercises: form.exercises.map((e) => ({ ...e, sets: Math.max(0, Math.round(Number(e.sets) || 0)) }))
    })
    toast('Treino salvo.')
    await router.replace(`/treinos/${modalityId}`)
  } catch (e) {
    toastError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="modality && found" class="space-y-5 pb-24">
    <header>
      <RouterLink :to="`/treinos/${modalityId}`" class="btn-ghost -ml-3"><ArrowLeft :size="18" /> {{ modality.name }}</RouterLink>
      <h1 class="h-page mt-1">{{ isNew ? 'Novo treino' : 'Editar treino' }}</h1>
      <p v-if="!isNew" class="muted mt-1">Alterar exercícios não muda o histórico já registrado.</p>
    </header>

    <form id="wf" class="space-y-5" @submit.prevent="save">
      <section class="card space-y-4">
        <div>
          <label class="label" for="w-name">Nome</label>
          <input id="w-name" v-model="form.name" class="input" placeholder="Ex.: Upper A, Treino 1" maxlength="40" required />
        </div>
        <div>
          <label class="label" for="w-desc">Descrição (opcional)</label>
          <input id="w-desc" v-model="form.description" class="input" placeholder="Ex.: Foco em peito e costas" maxlength="120" />
        </div>
        <div>
          <label class="label" for="w-goal">Meta ou referência (opcional)</label>
          <input id="w-goal" v-model="form.goal" class="input" placeholder="Ex.: 2.400 m em 12 min" maxlength="120" />
        </div>
        <div>
          <label class="label" for="w-notes">Observações (opcional)</label>
          <textarea id="w-notes" v-model="form.notes" class="input min-h-[72px]" maxlength="500" />
        </div>
        <label class="flex min-h-[44px] items-center gap-3 text-sm font-medium">
          <input v-model="form.active" type="checkbox" class="h-5 w-5 rounded accent-brand-600" /> Ativo na rotação
        </label>
      </section>

      <section class="space-y-3">
        <h2 class="font-bold">{{ isSets ? 'Exercícios' : 'Itens do treino' }}</h2>
        <EmptyState v-if="!form.exercises.length" title="Nenhum exercício" text="Treinos sem exercícios são permitidos, mas não terão o que registrar." />
        <div v-for="(e, i) in form.exercises" :key="e.id" class="card space-y-3">
          <div class="flex items-center gap-2">
            <input v-model="e.name" class="input font-semibold" :placeholder="isSets ? 'Nome do exercício' : 'Nome do item'" maxlength="60" :aria-label="`Nome do exercício ${i + 1}`" required />
            <button type="button" class="icon-btn" :disabled="i === 0" aria-label="Subir" @click="mv(i, -1)"><ArrowUp :size="18" /></button>
            <button type="button" class="icon-btn" :disabled="i === form.exercises.length - 1" aria-label="Descer" @click="mv(i, 1)"><ArrowDown :size="18" /></button>
            <button type="button" class="icon-btn text-red-500" aria-label="Remover exercício" @click="form.exercises.splice(i, 1)"><Trash2 :size="18" /></button>
          </div>
          <div v-if="isSets" class="grid grid-cols-4 gap-2">
            <div>
              <label class="label">Séries</label>
              <input v-model.number="e.sets" class="input text-center" type="number" inputmode="numeric" min="0" max="50" />
            </div>
            <div>
              <label class="label">Reps</label>
              <input v-model="e.reps" class="input text-center" placeholder="8-12" maxlength="30" />
            </div>
            <div>
              <label class="label">Carga</label>
              <input class="input text-center" type="text" inputmode="decimal" :value="e.load ?? ''" placeholder="—" @input="loadInput(e, $event)" />
            </div>
            <div>
              <label class="label">Unid.</label>
              <input v-model="e.unit" class="input text-center" maxlength="6" />
            </div>
          </div>
          <div v-if="isSets" class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">Duração (s)</label>
              <input class="input text-center" type="text" inputmode="numeric" :value="e.durationSec ?? ''" placeholder="—" :aria-label="`Duração em segundos de ${e.name || 'exercício'}`" @input="secInput(e, 'durationSec', $event)" />
            </div>
            <div>
              <label class="label">Descanso (s)</label>
              <input class="input text-center" type="text" inputmode="numeric" :value="e.restSec ?? ''" placeholder="padrão" :aria-label="`Descanso em segundos de ${e.name || 'exercício'}`" @input="secInput(e, 'restSec', $event)" />
            </div>
          </div>
          <div v-else>
            <label class="label">Descrição / duração / distância</label>
            <input v-model="e.reps" class="input" placeholder="Ex.: 30 min em ritmo leve" maxlength="120" />
          </div>
          <input v-model="e.notes" class="input" placeholder="Instruções / observações (opcional)" maxlength="200" />
        </div>
        <button type="button" class="btn-soft w-full" @click="addEx"><Plus :size="16" /> Adicionar {{ isSets ? 'exercício' : 'item' }}</button>
      </section>
    </form>

    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div class="mx-auto grid max-w-3xl grid-cols-2 gap-2 md:pl-60">
        <button class="btn-soft" type="button" @click="router.back()">Cancelar</button>
        <button class="btn-primary" type="submit" form="wf" :disabled="saving">Salvar treino</button>
      </div>
    </div>
  </div>
  <EmptyState v-else title="Treino não encontrado"><RouterLink :to="`/treinos/${modalityId}`" class="btn-primary">Voltar</RouterLink></EmptyState>
</template>
