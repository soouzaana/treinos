<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { MONTHS, WEEKDAYS_SHORT, toDateKey } from '@/utils/date'

export interface DayMark {
  color: string
  status: 'completed' | 'in_progress' | 'skipped'
}

const props = defineProps<{ year: number; month: number; selected: string; marks: Record<string, DayMark[]> }>()
const emit = defineEmits<{ select: [string]; nav: [number] }>()
const today = toDateKey()
const pad = (n: number) => String(n).padStart(2, '0')

const cells = computed(() => {
  const first = new Date(props.year, props.month, 1)
  const lead = (first.getDay() + 6) % 7 // segunda = 0
  const days = new Date(props.year, props.month + 1, 0).getDate()
  const out: Array<{ key: string; day: number } | null> = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) out.push({ key: `${props.year}-${pad(props.month + 1)}-${pad(d)}`, day: d })
  return out
})
const heads = [1, 2, 3, 4, 5, 6, 0].map((i) => WEEKDAYS_SHORT[i])
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <button class="icon-btn" aria-label="Mês anterior" @click="emit('nav', -1)"><ChevronLeft :size="20" /></button>
      <h2 class="font-bold">{{ MONTHS[month] }} {{ year }}</h2>
      <button class="icon-btn" aria-label="Próximo mês" @click="emit('nav', 1)"><ChevronRight :size="20" /></button>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center">
      <span v-for="h in heads" :key="h" class="py-1 text-[11px] font-bold uppercase text-slate-400">{{ h }}</span>
      <template v-for="(c, i) in cells" :key="i">
        <span v-if="!c" />
        <button
          v-else
          class="flex min-h-[52px] flex-col items-center justify-start gap-1 rounded-xl py-1.5 text-sm font-semibold transition active:scale-95"
          :class="[
            c.key === selected ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
            c.key === today && c.key !== selected ? 'ring-2 ring-brand-500/60' : ''
          ]"
          :aria-label="c.key" :aria-pressed="c.key === selected"
          @click="emit('select', c.key)"
        >
          {{ c.day }}
          <span class="flex min-h-[8px] flex-wrap justify-center gap-0.5 px-0.5">
            <span
              v-for="(m, k) in (marks[c.key] ?? []).slice(0, 5)" :key="k" class="h-2 w-2 rounded-full"
              :style="m.status === 'completed' ? { background: m.color } : m.status === 'in_progress' ? { border: `2px solid ${m.color}` } : { background: m.color, opacity: 0.3 }"
            />
          </span>
        </button>
      </template>
    </div>
    <p class="muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-slate-500" /> concluído</span>
      <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full border-2 border-slate-500" /> em andamento</span>
      <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-slate-500/30" /> não realizado</span>
    </p>
  </div>
</template>
