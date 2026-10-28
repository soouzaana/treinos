const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function weekdayOf(key: string): number {
  return fromDateKey(key).getDay()
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** Início da semana (segunda-feira) */
export function startOfWeek(key: string): string {
  const wd = weekdayOf(key)
  return addDays(key, -((wd + 6) % 7))
}

export function weekKeys(key: string): string[] {
  const s = startOfWeek(key)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

export const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function formatLong(key: string): string {
  const d = fromDateKey(key)
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`
}

export function formatShort(key: string): string {
  const d = fromDateKey(key)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDM(key: string): string {
  const d = fromDateKey(key)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

export function monthKey(key: string): string {
  return key.slice(0, 7)
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (m >= 60) return `${Math.floor(m / 60)}h${pad(m % 60)}min`
  return m > 0 ? `${m}min${s ? ` ${pad(s)}s` : ''}` : `${s}s`
}
