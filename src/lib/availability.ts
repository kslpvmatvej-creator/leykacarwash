import business from '../business.json'
import type { BusyInterval, SlotConfig } from './slots'

/** Окно записи, дней вперёд (включая сегодня) */
export const DAYS_AHEAD = business.bookingWindowDays

const MIN = 60_000
const hhmm = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

/** Конфиг генератора слотов из business.json — единый источник графика, шага и подготовки бокса */
export const SLOT_CONFIG: Partial<SlotConfig> = {
  openMin: hhmm(business.workingHours.open),
  closeMin: hhmm(business.workingHours.close),
  stepMin: business.slotStepMinutes,
  bufferMin: business.prepTimeMinutes,
  minLeadMin: business.minLeadTimeMinutes,
  utcOffsetMin: business.utcOffsetMinutes,
  closedWeekdays: business.closedWeekdays as number[],
}
export const BUFFER_MIN = business.prepTimeMinutes
const OFFSET = business.utcOffsetMinutes

/* ---------- Время в часовом поясе студии (не в поясе браузера) ---------- */

const shifted = (ms: number) => new Date(ms + OFFSET * MIN)
const p2 = (n: number) => String(n).padStart(2, '0')

/** «2026-10-13» — дата в часовом поясе студии */
export const bizDateKey = (ms: number) => shifted(ms).toISOString().slice(0, 10)

/** «14:30» */
export const bizTime = (iso: string | number) => {
  const d = shifted(typeof iso === 'number' ? iso : Date.parse(iso))
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}

export const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

const utcDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const fmt = (key: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { ...o, timeZone: 'UTC' }).format(utcDate(key))

export const dayParts = (key: string) => ({
  weekday: fmt(key, { weekday: 'short' }).replace('.', ''),
  day: fmt(key, { day: 'numeric' }),
  month: fmt(key, { month: 'short' }).replace('.', ''),
  isWeekend: [0, 6].includes(utcDate(key).getUTCDay()),
})

/** «13 октября» по ключу даты или моменту */
export const longDate = (v: string | number) =>
  fmt(typeof v === 'number' ? bizDateKey(v) : bizDateKey(Date.parse(v)), { day: 'numeric', month: 'long' })

/* ---------- Статус бокса для плиток ---------- */

export type BoxStatus = { kind: 'free' | 'busy' | 'closed'; text: string }

export const isOpenAt = (now: Date) => {
  const d = shifted(now.getTime())
  const min = d.getUTCHours() * 60 + d.getUTCMinutes()
  return !(business.closedWeekdays as number[]).includes(d.getUTCDay()) && min >= hhmm(business.workingHours.open) && min < hhmm(business.workingHours.close)
}

/** Текущий статус бокса. active = включён владельцем; busy — интервалы ЭТОГО бокса */
export function boxStatus(now: Date, busy: BusyInterval[], active: boolean): BoxStatus {
  if (!active) return { kind: 'closed', text: 'Сегодня не принимает' }
  if (!isOpenAt(now)) return { kind: 'closed', text: `Закрыто, работаем с ${business.workingHours.open}` }

  const nowMs = now.getTime()
  const list = busy
    .map((b) => ({ s: Date.parse(b.start_at), e: Date.parse(b.busy_until) }))
    .sort((a, b) => a.s - b.s)

  if (list.some((b) => b.s <= nowMs && nowMs < b.e)) {
    // Склеиваем подряд идущие брони: бокс освободится, когда закончится цепочка
    let freeAt = nowMs
    for (const b of list) if (b.s <= freeAt && b.e > freeAt) freeAt = b.e
    const same = bizDateKey(freeAt) === bizDateKey(nowMs)
    return { kind: 'busy', text: same ? `Занят до ${bizTime(freeAt)}` : `Занят. Свободен ${longDate(freeAt)} с ${bizTime(freeAt)}` }
  }
  const next = list.find((b) => b.s > nowMs && bizDateKey(b.s) === bizDateKey(nowMs))
  return { kind: 'free', text: next ? `Свободен до ${bizTime(next.s)}` : 'Свободен' }
}
