import { ref } from 'vue'

export interface ToastItem {
  id: number
  text: string
  kind: 'ok' | 'error' | 'info'
}

export const toasts = ref<ToastItem[]>([])
let seq = 0

export function toast(text: string, kind: ToastItem['kind'] = 'ok', ms = 3200) {
  const id = ++seq
  toasts.value.push({ id, text, kind })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, ms)
}

export function toastError(e: unknown, fallback = 'Algo deu errado.') {
  toast(e instanceof Error && e.message ? e.message : fallback, 'error', 5000)
}
