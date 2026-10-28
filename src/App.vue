<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { CalendarCheck, CalendarDays, Dumbbell, Ellipsis, History, LineChart, Loader2, Settings, Target } from 'lucide-vue-next'
import { usePrefsStore } from '@/stores/prefs'
import { useSessionsStore } from '@/stores/sessions'
import { loadAll, requestPersistence } from '@/composables/useBootstrap'
import { initRestTimer } from '@/composables/useRestTimer'
import RestTimerFab from '@/components/RestTimerFab.vue'
import ToastHost from '@/components/ToastHost.vue'
import ConfirmHost from '@/components/ConfirmHost.vue'
import UpdatePrompt from '@/components/UpdatePrompt.vue'

const prefs = usePrefsStore()
const sessions = useSessionsStore()
const route = useRoute()
const ready = ref(false)
const loadError = ref<string | null>(null)

const bottom = [
  { to: '/', label: 'Hoje', icon: CalendarCheck, match: ['hoje', 'sessao'] },
  { to: '/planejamento', label: 'Plano', icon: CalendarDays, match: ['planejamento'] },
  { to: '/treinos', label: 'Treinos', icon: Dumbbell, match: ['treinos', 'modalidade', 'treino'] },
  { to: '/taf', label: 'TAF', icon: Target, match: ['taf'] },
  { to: '/mais', label: 'Mais', icon: Ellipsis, match: ['mais', 'desempenho', 'historico', 'config'] }
]
const side = [
  { to: '/', label: 'Hoje', icon: CalendarCheck, match: ['hoje', 'sessao'] },
  { to: '/planejamento', label: 'Planejamento', icon: CalendarDays, match: ['planejamento'] },
  { to: '/treinos', label: 'Treinos', icon: Dumbbell, match: ['treinos', 'modalidade', 'treino'] },
  { to: '/desempenho', label: 'Desempenho', icon: LineChart, match: ['desempenho'] },
  { to: '/taf', label: 'TAF', icon: Target, match: ['taf'] },
  { to: '/historico', label: 'Histórico', icon: History, match: ['historico'] },
  { to: '/config', label: 'Configurações', icon: Settings, match: ['config', 'mais'] }
]
const isActive = (match: string[]) => match.includes(String(route.name))
const focusMode = computed(() => !!route.meta.focus)

function applyTheme() {
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#f8fafc')
}
watch(() => prefs.theme, applyTheme)

onMounted(async () => {
  try {
    await loadAll()
    applyTheme()
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
    initRestTimer()
    void requestPersistence()
  } catch (e) {
    console.error(e)
    loadError.value = 'Não foi possível abrir o banco de dados local. Verifique se o navegador permite armazenamento (sem aba anônima).'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <div v-if="!ready" class="flex min-h-dvh items-center justify-center text-slate-400">
    <Loader2 class="animate-spin" :size="28" />
  </div>
  <div v-else class="min-h-dvh md:pl-60">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-5 dark:border-slate-800 dark:bg-slate-900 md:flex">
      <p class="mb-5 px-3 text-lg font-extrabold tracking-tight">Treinos <span class="text-brand-600">TAF</span></p>
      <RouterLink
        v-for="i in side" :key="i.to" :to="i.to"
        class="mb-1 flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
        :class="isActive(i.match) ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'"
      ><component :is="i.icon" :size="20" /> {{ i.label }}</RouterLink>
    </aside>

    <main class="mx-auto w-full max-w-3xl px-4 pb-40 pt-[max(1rem,env(safe-area-inset-top))] md:pb-16 md:pt-8">
      <p v-if="loadError" class="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">{{ loadError }}</p>
      <p v-else-if="sessions.error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">{{ sessions.error }}</p>
      <RouterView />
    </main>

    <nav
      v-if="!focusMode"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
      aria-label="Navegação principal"
    >
      <ul class="mx-auto flex max-w-xl">
        <li v-for="i in bottom" :key="i.to" class="flex-1">
          <RouterLink
            :to="i.to"
            class="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition"
            :class="isActive(i.match) ? 'text-brand-600 dark:text-brand-100' : 'text-slate-500 dark:text-slate-400'"
          >
            <component :is="i.icon" :size="22" :stroke-width="isActive(i.match) ? 2.5 : 2" />
            {{ i.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <RestTimerFab />
    <UpdatePrompt />
  </div>
  <ToastHost />
  <ConfirmHost />
</template>
