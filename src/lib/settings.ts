import { useCallback, useEffect, useState } from 'react'

import business from '../business.json'
import { supabase } from '../supabaseClient'
import { TABLES } from './tables'
import { SERVICES, resolveServices, type BoxActiveMap, type ServiceCatalog, type ServicesConfig } from './slots'

/** Настройки владельца из таблицы vladislav_settings (одна строка на бизнес) */
export type ShopSettings = {
  /** Бокс принимает клиентов: { 1: true, 2: false, 3: true } */
  boxActive: Record<1 | 2 | 3, boolean>
  discountEnabled: boolean
  /** 0–90 */
  discountPercent: number
  /** Правки прайса владельца (как в БД); null — используется каталог по умолчанию */
  servicesConfig: ServicesConfig | null
  /** Рабочий каталог без скрытых услуг: дефолт + свои услуги + servicesConfig. Его берут форма записи и генератор слотов */
  services: ServiceCatalog
  /** Каталог вместе со скрытыми услугами — только для админки */
  allServices: ServiceCatalog
}

export const DEFAULT_SETTINGS: ShopSettings = {
  boxActive: { 1: true, 2: true, 3: true },
  discountEnabled: false,
  discountPercent: 0,
  servicesConfig: null,
  services: SERVICES,
  allServices: SERVICES,
}

const BUSINESS_ID = business.businessId
export const MAX_DISCOUNT = 90

type Row = {
  box_1_active?: boolean | null
  box_2_active?: boolean | null
  box_3_active?: boolean | null
  discount_enabled?: boolean | null
  discount_percent?: number | null
  services_config?: unknown
}

export const clampPercent = (v: unknown) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(MAX_DISCOUNT, Math.max(0, n)) : 0
}

const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)

function fromRow(r: Row): ShopSettings {
  return {
    boxActive: { 1: r.box_1_active !== false, 2: r.box_2_active !== false, 3: r.box_3_active !== false },
    discountEnabled: !!r.discount_enabled,
    discountPercent: clampPercent(r.discount_percent),
    servicesConfig: isObject(r.services_config) ? (r.services_config as ServicesConfig) : null,
    services: resolveServices(r.services_config),
    allServices: resolveServices(r.services_config, true),
  }
}

/**
 * Читает настройки. null — запрос не удался (таблицы нет / сеть): вызывающий решает, что делать.
 * Строки нет — значения по умолчанию (всё включено, скидки нет).
 */
export async function loadSettings(): Promise<ShopSettings | null> {
  const { data, error } = await supabase
    .from(TABLES.settings)
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .maybeSingle()
  if (error) {
    console.warn('vladislav_settings недоступна', error.message)
    return null
  }
  return data ? fromRow(data as Row) : DEFAULT_SETTINGS
}

export type SettingsPatch = Partial<{
  boxActive: Partial<Record<1 | 2 | 3, boolean>>
  discountEnabled: boolean
  discountPercent: number
  /** null — сбросить прайс к каталогу по умолчанию */
  servicesConfig: ServicesConfig | null
}>

/** Сохраняет только изменённые колонки (upsert), чтобы не затирать остальные поля. Возвращает текст ошибки или null */
export async function saveSettings(patch: SettingsPatch): Promise<string | null> {
  const row: Record<string, unknown> = { business_id: BUSINESS_ID }
  for (const n of [1, 2, 3] as const) {
    const v = patch.boxActive?.[n]
    if (v !== undefined) row[`box_${n}_active`] = v
  }
  if (patch.discountEnabled !== undefined) row.discount_enabled = patch.discountEnabled
  if (patch.discountPercent !== undefined) row.discount_percent = clampPercent(patch.discountPercent)
  if (patch.servicesConfig !== undefined) row.services_config = patch.servicesConfig
  const { error } = await supabase.from(TABLES.settings).upsert(row, { onConflict: 'business_id' })
  if (error) {
    console.error(error)
    if (error.code === '42501') return 'Нет прав: войдите как владелец.'
    if (error.code === 'PGRST204' || error.code === '42703') return 'В vladislav_settings нет колонки services_config — выполните ALTER TABLE.'
    return 'Не удалось сохранить настройки.'
  }
  return null
}

/** Для генератора слотов */
export const toBoxActive = (s: ShopSettings): BoxActiveMap => ({ ...s.boxActive })

/* ---------- Скидка ---------- */

/** Действующий процент: 0, если скидка выключена */
export const activeDiscount = (s: Pick<ShopSettings, 'discountEnabled' | 'discountPercent'>) =>
  s.discountEnabled && s.discountPercent > 0 ? s.discountPercent : 0

/** Цена со скидкой, целые рубли */
export const discounted = (price: number, percent: number) =>
  percent > 0 ? Math.round((price * (100 - percent)) / 100) : price

/** Для вывода: oldPrice есть только когда скидка действует (его рисуем зачёркнутым) */
export const priceView = (price: number, percent: number) =>
  percent > 0 ? { price: discounted(price, percent), oldPrice: price } : { price, oldPrice: null as number | null }

/* ---------- Хук для клиента: настройки + периодическое обновление ---------- */

/** Загружает настройки и обновляет их раз в minute; reload() — принудительно (например, перед записью) */
export function useShopSettings(refreshMs = 60_000) {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async (): Promise<ShopSettings | null> => {
    const s = await loadSettings()
    // Ошибка загрузки: оставляем последние известные значения, чтобы сайт не «мигал»
    if (s) setSettings(s)
    setLoaded(true)
    return s
  }, [])

  useEffect(() => {
    void reload()
    const t = window.setInterval(() => void reload(), refreshMs)
    return () => window.clearInterval(t)
  }, [reload, refreshMs])

  return { settings, loaded, reload }
}
