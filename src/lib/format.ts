import { pluralDays } from './plural'

export const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`

export const formatPrice = (value: number) => `${Number(value).toLocaleString('ru-RU')} ₽`

export const formatDuration = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h} ч` : '', m ? `${m} мин` : ''].filter(Boolean).join(' ')
}

export const withTime = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

/** Цифры телефона → «+7 (999) 123-45-67» */
export const formatPhone = (raw: string) => {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('8')) digits = '7' + digits.slice(1)
  if (digits && !digits.startsWith('7')) digits = '7' + digits
  digits = digits.slice(0, 11)
  const p = [digits.slice(1, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)]
  let out = digits ? '+7' : ''
  if (p[0]) out += ` (${p[0]}`
  if (p[0].length === 3) out += ')'
  if (p[1]) out += ` ${p[1]}`
  if (p[2]) out += `-${p[2]}`
  if (p[3]) out += `-${p[3]}`
  return out
}

/** Цвет текста на брендовом фоне: тёмный или белый — по яркости */
export const readableOn = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#18181b' : '#ffffff'
}

/** 60 → «1 час», 180 → «3 часа», 90 → «1 час 30 минут» */
export const durationWords = (min: number) => {
  const word = (n: number, one: string, few: string, many: string) => {
    const m100 = n % 100
    const m10 = n % 10
    if (m100 >= 11 && m100 <= 14) return many
    if (m10 === 1) return one
    if (m10 >= 2 && m10 <= 4) return few
    return many
  }
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h} ${word(h, 'час', 'часа', 'часов')}` : '', m ? `${m} ${word(m, 'минута', 'минуты', 'минут')}` : '']
    .filter(Boolean)
    .join(' ')
}

/** Подпись длительности услуги: «3 дня» или «6 ч 30 мин» */
export const formatServiceDuration = (s: { durationDays?: number; durationMinutes?: number }) =>
  s.durationDays ? `${s.durationDays} ${pluralDays(s.durationDays)}` : formatDuration(s.durationMinutes ?? 0)
