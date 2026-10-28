import { computed, ref } from 'vue'
import { usePrefsStore } from '@/stores/prefs'
import {
  finishedAgoMs, formatClock, idleTimer, pauseTimer, remainingMs, resetTimer, restartTimer,
  resumeTimer, startTimer, syncTimer, type TimerState
} from '@/services/timer'
import { formatDuration } from '@/utils/date'

/**
 * Cronômetro de descanso global. O tempo restante é SEMPRE calculado a partir de `endAt`
 * (timestamp), nunca por decremento de contador — por isso continua correto com a aba em
 * segundo plano, após trocar de tela ou recarregar. O intervalo abaixo só atualiza a tela.
 */
const now = ref(Date.now())
export const timerOpen = ref(false)
/** Aviso quando o intervalo terminou enquanto o app estava em segundo plano. */
export const timerNote = ref<string | null>(null)
let handle: ReturnType<typeof setInterval> | null = null
let alertedFor: number | null = null
let audio: AudioContext | null = null
let wired = false

function primeAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    audio ??= new AC()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* áudio indisponível */
  }
}

function beep() {
  if (!audio) return
  const t0 = audio.currentTime
  ;[0, 0.28, 0.56].forEach((d, i) => {
    const o = audio!.createOscillator()
    const g = audio!.createGain()
    o.type = 'sine'
    o.frequency.value = i === 2 ? 1175 : 880
    g.gain.setValueAtTime(0.0001, t0 + d)
    g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22)
    o.connect(g).connect(audio!.destination)
    o.start(t0 + d)
    o.stop(t0 + d + 0.25)
  })
}

function alertFinished() {
  const prefs = usePrefsStore()
  if (prefs.sound) beep()
  if (prefs.vibrate && 'vibrate' in navigator) navigator.vibrate([300, 120, 300, 120, 500])
}

function tick() {
  const prefs = usePrefsStore()
  now.value = Date.now()
  const t = prefs.timer
  if (t.status === 'running') {
    const s = syncTimer(t, now.value)
    if (s.status === 'finished') {
      void prefs.setTimer(s)
      const ago = finishedAgoMs(s, now.value)
      if (alertedFor !== s.endAt) {
        alertedFor = s.endAt
        if (ago < 4000) alertFinished()
        else timerNote.value = `O intervalo terminou há ${formatDuration(Math.round(ago / 1000))}.`
      }
    }
  }
  if (t.status !== 'running' && handle) {
    clearInterval(handle)
    handle = null
  }
}

function ensureTicking() {
  if (!handle) handle = setInterval(tick, 250)
}

/** Chamar uma vez ao iniciar o app (depois de carregar as preferências). */
export function initRestTimer() {
  if (wired) return
  wired = true
  const prefs = usePrefsStore()
  const t = prefs.timer
  if (t.status === 'finished' && finishedAgoMs(t, Date.now()) > 30 * 60 * 1000) void prefs.setTimer(resetTimer(t))
  else if (t.status === 'running') ensureTicking()
  tick()
  const onWake = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('focus', tick)
  window.addEventListener('pageshow', tick)
}

export function useRestTimer() {
  const prefs = usePrefsStore()
  const state = computed<TimerState>(() => (prefs.timer.status === 'running' ? syncTimer(prefs.timer, now.value) : prefs.timer))
  const remaining = computed(() => remainingMs(state.value, now.value))
  const clock = computed(() => formatClock(remaining.value))
  const progress = computed(() => {
    const d = state.value.durationMs || 1
    return state.value.status === 'idle' ? 0 : 1 - remaining.value / d
  })
  const active = computed(() => state.value.status !== 'idle')

  function start(sec: number) {
    primeAudio()
    timerNote.value = null
    alertedFor = null
    now.value = Date.now()
    void prefs.setTimer(startTimer(sec * 1000, now.value))
    ensureTicking()
  }
  function pause() {
    now.value = Date.now()
    void prefs.setTimer(pauseTimer(prefs.timer, now.value))
  }
  function resume() {
    primeAudio()
    now.value = Date.now()
    void prefs.setTimer(resumeTimer(prefs.timer, now.value))
    ensureTicking()
  }
  function restart() {
    primeAudio()
    timerNote.value = null
    alertedFor = null
    now.value = Date.now()
    void prefs.setTimer(restartTimer(prefs.timer, now.value))
    ensureTicking()
  }
  function reset() {
    timerNote.value = null
    void prefs.setTimer(idleTimer(prefs.timer.durationMs))
  }
  /** Usado pelo registro de séries: inicia o descanso padrão (se a opção estiver ligada). */
  function autoStart(sec?: number | null) {
    if (prefs.autoRest) start(sec && sec > 0 ? sec : prefs.defaultRestSec)
  }

  return { state, remaining, clock, progress, active, start, pause, resume, restart, reset, autoStart }
}
