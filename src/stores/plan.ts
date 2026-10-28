import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import type { WeekPlanDay } from '@/types'

export const usePlanStore = defineStore('plan', () => {
  const days = ref<WeekPlanDay[]>(Array.from({ length: 7 }, (_, weekday) => ({ weekday, rest: false, modalityIds: [] })))
  const error = ref<string | null>(null)

  async function load() {
    try {
      const rows = await db.weekPlan.toArray()
      days.value = Array.from({ length: 7 }, (_, weekday) => ({ weekday, rest: false, modalityIds: [] }))
      for (const r of rows) {
        const i = days.value.findIndex((d) => d.weekday === r.weekday)
        if (i >= 0) days.value[i] = r
      }
    } catch (e) {
      error.value = 'Não foi possível carregar o planejamento.'
      console.error(e)
    }
  }

  const dayOf = (weekday: number): WeekPlanDay => days.value.find((d) => d.weekday === weekday)!

  async function saveDay(d: WeekPlanDay) {
    const clean: WeekPlanDay = { weekday: d.weekday, rest: d.rest, modalityIds: [...new Set(d.modalityIds)] }
    await db.weekPlan.put(clean)
    days.value[days.value.findIndex((x) => x.weekday === d.weekday)] = clean
  }

  async function addModality(weekday: number, modalityId: string) {
    const d = dayOf(weekday)
    if (d.modalityIds.includes(modalityId)) return
    await saveDay({ ...d, rest: false, modalityIds: [...d.modalityIds, modalityId] })
  }

  async function removeModality(weekday: number, modalityId: string) {
    const d = dayOf(weekday)
    await saveDay({ ...d, modalityIds: d.modalityIds.filter((i) => i !== modalityId) })
  }

  async function moveModality(weekday: number, modalityId: string, dir: -1 | 1) {
    const d = dayOf(weekday)
    const ids = [...d.modalityIds]
    const i = ids.indexOf(modalityId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await saveDay({ ...d, modalityIds: ids })
  }

  async function setRest(weekday: number, rest: boolean) {
    const d = dayOf(weekday)
    await saveDay({ ...d, rest, modalityIds: rest ? [] : d.modalityIds })
  }

  /** Remove uma modalidade excluída de todos os dias (não mexe no histórico). */
  async function purgeModality(modalityId: string) {
    for (const d of days.value) if (d.modalityIds.includes(modalityId)) await removeModality(d.weekday, modalityId)
  }

  return { days, error, load, dayOf, saveDay, addModality, removeModality, moveModality, setRest, purgeModality }
})
