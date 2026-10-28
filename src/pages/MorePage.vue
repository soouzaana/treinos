<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronRight, History, LineChart, Settings } from 'lucide-vue-next'

const items = [
  { to: '/desempenho', title: 'Desempenho', text: 'Frequência, conclusão, evolução dos exercícios e das provas.', icon: LineChart },
  { to: '/historico', title: 'Histórico', text: 'Calendário, sessões anteriores e correção de registros.', icon: History },
  { to: '/config', title: 'Configurações', text: 'Tema, cronômetro, backup, exemplo e dados.', icon: Settings }
]
</script>

<template>
  <div class="space-y-5">
    <h1 class="h-page">Mais</h1>
    <ul class="space-y-3">
      <li v-for="i in items" :key="i.to">
        <RouterLink :to="i.to" class="card flex items-center gap-4 !p-4 transition active:scale-[0.99]">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/20 dark:text-brand-100"><component :is="i.icon" :size="24" /></span>
          <span class="min-w-0 flex-1">
            <span class="block font-bold">{{ i.title }}</span>
            <span class="muted">{{ i.text }}</span>
          </span>
          <ChevronRight :size="20" class="text-slate-400" />
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
