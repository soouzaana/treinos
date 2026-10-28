import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (v: boolean) => void
}

export const pendingConfirm = ref<Pending | null>(null)

/** Confirmação baseada em Promise: `if (!(await confirmDialog({...}))) return`. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pendingConfirm.value = { ...opts, resolve }
  })
}

export function answerConfirm(v: boolean) {
  pendingConfirm.value?.resolve(v)
  pendingConfirm.value = null
}
