import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { db } from '@/db'
import { idleTimer, type TimerState } from '@/services/timer'

export type Theme = 'light' | 'dark' | 'system'

export const usePrefsStore = defineStore('prefs', () => {
  const theme = ref<Theme>('system')
  const defaultRestSec = ref(90)
  const sound = ref(true)
  const vibrate = ref(true)
  const autoRest = ref(true)
  const timer = ref<TimerState>(idleTimer(90000))
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    try {
      const rows = await db.settings.toArray()
      const get = <T>(k: string, d: T): T => (rows.find((r) => r.key === k)?.value as T) ?? d
      theme.value = get<Theme>('theme', 'system')
      defaultRestSec.value = get<number>('defaultRestSec', 90)
      sound.value = get<boolean>('sound', true)
      vibrate.value = get<boolean>('vibrate', true)
      autoRest.value = get<boolean>('autoRest', true)
      timer.value = get<TimerState>('timer', idleTimer(defaultRestSec.value * 1000))
    } catch (e) {
      error.value = 'Não foi possível ler as configurações.'
      console.error(e)
    } finally {
      loaded.value = true
    }
  }

  async function save(key: string, value: unknown) {
    try {
      await db.settings.put({ key, value: JSON.parse(JSON.stringify(value)) })
    } catch (e) {
      error.value = 'Não foi possível salvar as configurações.'
      console.error(e)
    }
  }

  watch(theme, (v) => save('theme', v))
  watch(defaultRestSec, (v) => save('defaultRestSec', v))
  watch(sound, (v) => save('sound', v))
  watch(vibrate, (v) => save('vibrate', v))
  watch(autoRest, (v) => save('autoRest', v))

  async function setTimer(t: TimerState) {
    timer.value = t
    await save('timer', t)
  }

  return { theme, defaultRestSec, sound, vibrate, autoRest, timer, loaded, error, load, setTimer }
})
