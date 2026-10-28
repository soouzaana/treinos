<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ labels: string[]; values: Array<number | null>; max?: number; suffix?: string; color?: string; height?: number }>(),
  { max: 100, suffix: '%', color: '#6366f1', height: 140 }
)
const W = 320
const PAD = { l: 8, r: 8, t: 16, b: 22 }
const n = computed(() => props.labels.length)
const bw = computed(() => ((W - PAD.l - PAD.r) / Math.max(1, n.value)) * 0.62)
const cx = (i: number) => PAD.l + ((i + 0.5) / n.value) * (W - PAD.l - PAD.r)
const hOf = (v: number) => (Math.min(v, props.max) / props.max) * (props.height - PAD.t - PAD.b)
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${height}`" class="w-full" role="img" aria-label="Gráfico de barras">
    <line :x1="PAD.l" :x2="W - PAD.r" :y1="height - PAD.b" :y2="height - PAD.b" class="stroke-slate-300 dark:stroke-slate-700" stroke-width="0.8" />
    <g v-for="(v, i) in values" :key="i">
      <rect
        v-if="v !== null" :x="cx(i) - bw / 2" :y="height - PAD.b - hOf(v)" :width="bw" :height="Math.max(2, hOf(v))" rx="3" :fill="color"
      ><title>{{ labels[i] }}: {{ v }}{{ suffix }}</title></rect>
      <text v-if="v !== null" :x="cx(i)" :y="height - PAD.b - hOf(v) - 3" text-anchor="middle" font-size="9" class="fill-slate-600 dark:fill-slate-300">{{ v }}{{ suffix }}</text>
      <text v-else :x="cx(i)" :y="height - PAD.b - 4" text-anchor="middle" font-size="9" class="fill-slate-400">—</text>
      <text :x="cx(i)" :y="height - 7" text-anchor="middle" font-size="9" class="fill-slate-500 dark:fill-slate-400">{{ labels[i] }}</text>
    </g>
  </svg>
</template>
