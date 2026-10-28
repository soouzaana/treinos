<script setup lang="ts">
import { computed } from 'vue'

export interface LineSeries {
  name: string
  color: string
  values: Array<number | null>
  dashed?: boolean
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: LineSeries[]
    refLine?: { value: number; label: string } | null
    height?: number
    unit?: string
  }>(),
  { height: 170, refLine: null, unit: '' }
)

const W = 320
const PAD = { l: 38, r: 10, t: 12, b: 24 }

const range = computed(() => {
  const vals = props.series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  if (props.refLine) vals.push(props.refLine.value)
  if (!vals.length) return { min: 0, max: 1 }
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.12
  return { min: Math.max(0, min - pad), max: max + pad }
})

const n = computed(() => props.labels.length)
const x = (i: number) => PAD.l + (n.value <= 1 ? (W - PAD.l - PAD.r) / 2 : (i / (n.value - 1)) * (W - PAD.l - PAD.r))
const y = (v: number) => PAD.t + (1 - (v - range.value.min) / (range.value.max - range.value.min)) * (props.height - PAD.t - PAD.b)
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString())

const paths = computed(() =>
  props.series.map((s) => {
    let d = ''
    let pen = false
    s.values.forEach((v, i) => {
      if (v === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
      pen = true
    })
    return { ...s, d }
  })
)
const ticks = computed(() => [range.value.min, (range.value.min + range.value.max) / 2, range.value.max])
const xLabels = computed(() => {
  const l = props.labels
  if (l.length <= 3) return l.map((t, i) => ({ t, i }))
  return [0, Math.floor((l.length - 1) / 2), l.length - 1].map((i) => ({ t: l[i], i }))
})
</script>

<template>
  <div>
    <svg :viewBox="`0 0 ${W} ${height}`" class="w-full" role="img" :aria-label="`Gráfico: ${series.map((s) => s.name).join(', ')}`">
      <g class="text-slate-300 dark:text-slate-700">
        <line v-for="(tk, i) in ticks" :key="i" :x1="PAD.l" :x2="W - PAD.r" :y1="y(tk)" :y2="y(tk)" stroke="currentColor" stroke-width="0.6" />
      </g>
      <g class="fill-slate-500 dark:fill-slate-400" font-size="9">
        <text v-for="(tk, i) in ticks" :key="i" :x="PAD.l - 5" :y="y(tk) + 3" text-anchor="end">{{ fmt(tk) }}</text>
        <text v-for="l in xLabels" :key="l.i" :x="x(l.i)" :y="height - 6" :text-anchor="l.i === 0 ? 'start' : l.i === n - 1 ? 'end' : 'middle'">{{ l.t }}</text>
      </g>
      <g v-if="refLine">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(refLine.value)" :y2="y(refLine.value)" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4 3" />
        <text :x="W - PAD.r" :y="y(refLine.value) - 3" text-anchor="end" font-size="8.5" fill="#d97706">{{ refLine.label }}</text>
      </g>
      <g v-for="p in paths" :key="p.name">
        <path :d="p.d" fill="none" :stroke="p.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" :stroke-dasharray="p.dashed ? '4 3' : undefined" />
        <circle v-for="(v, i) in p.values" v-show="v !== null" :key="i" :cx="x(i)" :cy="v === null ? 0 : y(v)" r="3" :fill="p.color">
          <title>{{ labels[i] }}: {{ v }} {{ unit }}</title>
        </circle>
      </g>
    </svg>
    <div v-if="series.length > 1" class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      <span v-for="s in series" :key="s.name" class="inline-flex items-center gap-1.5">
        <span class="inline-block h-0.5 w-4" :style="{ background: s.color }" /> {{ s.name }}
      </span>
    </div>
  </div>
</template>
