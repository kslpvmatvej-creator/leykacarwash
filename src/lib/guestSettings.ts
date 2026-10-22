import { supabase } from '../supabaseClient'
import config from '../business.json'

/** Допустимые значения подготовки бокса между автомобилями, мин */
export const BUFFER_OPTIONS = [0, 15, 30, 45, 60] as const

/** Количество ссылок на фото в админке */
export const PHOTO_SLOTS = 4

/** Настройки одной парной */
export type GuestSettings = {
  /** Сколько человек включено в цену */
  baseGuests: number
  /** Максимум гостей (лимит кнопки «+») */
  maxGuests: number
  /** Доплата за каждого гостя сверх baseGuests, ₽ */
  extraGuestPrice: number
  /** Буфер на уборку после каждой брони, мин (0/5/10/15) */
  cleaningBufferMin: number
  /** Акция включена */
  promoEnabled: boolean
  /** Текст акции для бейджа */
  promoText: string
  /** Скидка, % */
  promoPercent: number
  /** Ссылки на фото (до PHOTO_SLOTS), пустые строки отброшены при показе */
  photos: string[]
}

/** Значения из БД (service_settings), ключ — id парной из business.json */
export type GuestSettingsMap = Record<string, Partial<GuestSettings>>

/** Что может лежать в business.json у парной */
type ServiceDefaults = Partial<GuestSettings> & { id: string }

const CONFIG_BUFFER = Number((config as { prepTimeMinutes?: number }).prepTimeMinutes) || 0

/** Если не задано ни в БД, ни в business.json */
const FALLBACK: GuestSettings = {
  baseGuests: 8,
  maxGuests: 10,
  extraGuestPrice: 0,
  cleaningBufferMin: CONFIG_BUFFER,
  promoEnabled: false,
  promoText: '',
  promoPercent: 0,
  photos: [],
}

const num = (v: unknown, def: number) => {
  if (v === null || v === undefined || v === '') return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

/** Ближайшее допустимое значение буфера (на случай старого/ручного значения в БД) */
const snapBuffer = (v: number) =>
  BUFFER_OPTIONS.reduce((best, o) => (Math.abs(o - v) < Math.abs(best - v) ? o : best), 0 as number)

/** Любая ссылка, начинающаяся с http:// или https:// (javascript:, data: и т.п. отбрасываем) */
export const isValidPhotoUrl = (s: string) => /^https?:\/\/./i.test(s.trim())

/** Приводит значения к допустимым: base ≥ 1, max ≥ base, доплата ≥ 0, скидка 0–99, буфер из списка */
export function normalizeGuestSettings(raw: Partial<GuestSettings>): GuestSettings {
  const baseGuests = Math.max(1, Math.floor(num(raw.baseGuests, FALLBACK.baseGuests)))
  const maxGuests = Math.max(baseGuests, Math.floor(num(raw.maxGuests, FALLBACK.maxGuests)))
  const extraGuestPrice = Math.max(0, num(raw.extraGuestPrice, FALLBACK.extraGuestPrice))
  const cleaningBufferMin = snapBuffer(Math.max(0, num(raw.cleaningBufferMin, FALLBACK.cleaningBufferMin)))
  const promoPercent = Math.min(99, Math.max(0, num(raw.promoPercent, 0)))
  const photos = (raw.photos ?? []).slice(0, PHOTO_SLOTS).map((p) => (p ?? '').trim())
  return {
    baseGuests,
    maxGuests,
    extraGuestPrice,
    cleaningBufferMin,
    promoEnabled: !!raw.promoEnabled,
    promoText: (raw.promoText ?? '').trim(),
    promoPercent,
    photos,
  }
}

/** Итоговые настройки парной: значения из админки → иначе из business.json → иначе дефолт */
export function resolveGuestSettings(
  service: ServiceDefaults,
  overrides: GuestSettingsMap
): GuestSettings {
  const o = overrides[service.id]
  return normalizeGuestSettings({
    baseGuests: o?.baseGuests ?? service.baseGuests,
    maxGuests: o?.maxGuests ?? service.maxGuests,
    extraGuestPrice: o?.extraGuestPrice ?? service.extraGuestPrice,
    cleaningBufferMin: o?.cleaningBufferMin ?? service.cleaningBufferMin,
    promoEnabled: o?.promoEnabled ?? service.promoEnabled,
    promoText: o?.promoText ?? service.promoText,
    promoPercent: o?.promoPercent ?? service.promoPercent,
    // Фото из админки по слотам; пустой слот добирается из business.json (запасные/тестовые фото)
    photos: Array.from({ length: PHOTO_SLOTS }, (_, i) => o?.photos?.[i]?.trim() || service.photos?.[i] || ''),
  })
}

/** Доплата за гостей сверх базового количества */
export function calcExtraGuests(guests: number, s: GuestSettings) {
  const extraGuests = Math.max(0, guests - s.baseGuests)
  return { extraGuests, extraGuestsSum: extraGuests * s.extraGuestPrice }
}

/** Акция действует, только если включена и скидка > 0 */
export const isPromoActive = (s: Pick<GuestSettings, 'promoEnabled' | 'promoPercent'> | null | undefined) =>
  !!s && s.promoEnabled && s.promoPercent > 0

/** Скидка на сумму брони (в целых рублях). Без акции — 0 */
export function calcDiscount(subtotal: number, s: GuestSettings | null) {
  if (!s || !isPromoActive(s)) return { discountPercent: 0, discountSum: 0 }
  const discountSum = Math.min(subtotal, Math.round((subtotal * s.promoPercent) / 100))
  return { discountPercent: s.promoPercent, discountSum }
}

/** Непустые корректные ссылки на фото */
export const visiblePhotos = (s: GuestSettings | null | undefined) =>
  (s?.photos ?? []).filter(isValidPhotoUrl).map((p) => p.trim())

const BASE_COLS = 'service_id, base_guests, max_guests, extra_guest_price'
const PHOTO_COLS = Array.from({ length: PHOTO_SLOTS }, (_, i) => `photo_url_${i + 1}`)
const NEW_COLS = 'cleaning_buffer_min, promo_enabled, promo_text, promo_percent'
const ALL_COLS = [BASE_COLS, NEW_COLS, ...PHOTO_COLS].join(', ')
// До миграции photo_url_4 (3 фото): читаем без неё, чтобы не потерять акцию и уборку
const NO_PHOTO4_COLS = [BASE_COLS, NEW_COLS, ...PHOTO_COLS.slice(0, 3)].join(', ')

type Row = Record<string, unknown>

/** Читает настройки из Supabase. null — таблицы ещё нет или ошибка: тогда работаем по business.json */
export async function loadGuestSettings(businessId: string): Promise<GuestSettingsMap | null> {
  type Res = { data: unknown; error: { code?: string; message: string } | null }
  let res: Res = await supabase.from('service_settings').select(ALL_COLS).eq('business_id', businessId)
  const missingColumn = (e: Res['error']) => e?.code === '42703' || e?.code === 'PGRST204'
  // 42703 / PGRST204 — колонки ещё не добавлены миграцией: сначала без photo_url_4, затем только старые поля
  if (missingColumn(res.error)) {
    res = await supabase.from('service_settings').select(NO_PHOTO4_COLS).eq('business_id', businessId)
  }
  if (missingColumn(res.error)) {
    res = await supabase.from('service_settings').select(BASE_COLS).eq('business_id', businessId)
  }
  if (res.error) {
    console.warn('service_settings недоступна, используем business.json', res.error.message)
    return null
  }
  const map: GuestSettingsMap = {}
  for (const r of (res.data ?? []) as unknown as Row[]) {
    const entry: Partial<GuestSettings> = {
      baseGuests: num(r.base_guests, FALLBACK.baseGuests),
      maxGuests: num(r.max_guests, FALLBACK.maxGuests),
      extraGuestPrice: num(r.extra_guest_price, FALLBACK.extraGuestPrice),
    }
    // Новые поля кладём, только если они есть в ответе и не NULL — иначе действует business.json/дефолт
    if (r.cleaning_buffer_min != null) entry.cleaningBufferMin = num(r.cleaning_buffer_min, CONFIG_BUFFER)
    if ('promo_enabled' in r) {
      entry.promoEnabled = !!r.promo_enabled
      entry.promoText = String(r.promo_text ?? '')
      entry.promoPercent = num(r.promo_percent, 0)
      entry.photos = PHOTO_COLS.map((col) => String(r[col] ?? ''))
    }
    map[r.service_id as string] = entry
  }
  return map
}

/** Сохраняет настройки одной парной (только владелец, см. RLS). Возвращает ошибку или null */
export async function saveGuestSettings(
  businessId: string,
  serviceId: string,
  s: GuestSettings
): Promise<{ code?: string; message: string } | null> {
  const photos = Array.from({ length: PHOTO_SLOTS }, (_, i) => s.photos[i]?.trim() || null)
  const { error } = await supabase.from('service_settings').upsert(
    {
      business_id: businessId,
      service_id: serviceId,
      base_guests: s.baseGuests,
      max_guests: s.maxGuests,
      extra_guest_price: s.extraGuestPrice,
      cleaning_buffer_min: s.cleaningBufferMin,
      promo_enabled: s.promoEnabled,
      promo_text: s.promoText.trim() || null,
      promo_percent: s.promoPercent,
      ...Object.fromEntries(PHOTO_COLS.map((col, i) => [col, photos[i]])),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'business_id,service_id' }
  )
  return error ? { code: error.code, message: error.message } : null
}
