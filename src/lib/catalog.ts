import {
  Armchair, Car, CalendarDays, Clock, Crown, Disc3, Droplets, Gem, Layers, Paintbrush, Shield, ShieldCheck,
  Sparkles, SprayCan, Sun, Truck, Wind, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'

import config from '../business.json'
import type { GuestSettings } from './guestSettings'
import { SERVICES, BOX_DEFS, type BoxType, type CarClass, type ServiceCatalog, type ServiceId } from './slots'

/** Бокс для витрины (фото, подпись). Номер бокса в генераторе = число в id: 'box-2' → 2 */
export type Box = Partial<GuestSettings> & {
  id: string
  name: string
  specialty?: string
  businessId?: string
  description?: string
  icon?: string
  features?: string[]
}

export type Extra = { id: string; name: string; price: number; icon?: string }
export type VehicleClass = { id: CarClass; label: string; hint?: string }

export const BOXES = config.boxes as Box[]
export const EXTRAS = config.extras as Extra[]
export const VEHICLE_CLASSES = config.vehicleClasses as VehicleClass[]

export const boxBusinessId = (b: Box) => b.businessId || config.businessId
export const ALL_BUSINESS_IDS = [...new Set(BOXES.map(boxBusinessId))]
export const boxNumber = (b: Box) => Number(b.id.match(/(\d+)$/)?.[1])

/* ---------- Услуги: цены и длительность берём из lib/slots.ts (единый источник) ---------- */

/** Иконка и категория стандартных услуг; у своих услуг они задаются в админке (иначе — по типу бокса) */
const SERVICE_META: Record<string, { icon: string; category: string }> = {
  complex_wash: { icon: 'Droplets', category: 'Мойка' },
  detailing_wash: { icon: 'SprayCan', category: 'Мойка' },
  polishing: { icon: 'Gem', category: 'Детейлинг' },
  dry_cleaning: { icon: 'Armchair', category: 'Детейлинг' },
}

export type ServiceItem = {
  id: ServiceId
  name: string
  category: string
  icon: string
  boxType: BoxType
  /** Цена для седана — для подписи «от» */
  priceFrom: number
  description?: string
}

/** Список услуг для витрины. catalog — актуальный каталог из настроек (vladislav_settings), по умолчанию SERVICES */
export const serviceItems = (catalog: ServiceCatalog = SERVICES): ServiceItem[] =>
  Object.keys(catalog).map((id) => {
    const s = catalog[id]
    const meta = SERVICE_META[id]
    return {
      id,
      name: s.title,
      boxType: s.boxType,
      priceFrom: Math.min(...Object.values(s.price)),
      category: s.category ?? meta?.category ?? (s.boxType === 'washing' ? 'Мойка' : 'Детейлинг'),
      icon: s.icon ?? meta?.icon ?? 'Sparkles',
      description: s.description,
    }
  })

/** Описание → пункты «Что входит»: каждая строка отдельный пункт, маркеры (-, •, ✓) срезаются, максимум 12 */
export const splitIncluded = (text?: string): string[] =>
  (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-–—•*✓✔·]+/, '').trim())
    .filter(Boolean)
    .slice(0, 12)

/** Категории для фильтра прайса — из актуального каталога (свои услуги могут добавлять новые) */
export const serviceCategories = (catalog: ServiceCatalog = SERVICES): string[] => [
  ...new Set(serviceItems(catalog).map((s) => s.category)),
]

/** Минимальная цена услуг, которые делает бокс (по типу бокса) — для «от … ₽» на плитке */
export const boxPriceFrom = (box: Box, catalog: ServiceCatalog = SERVICES) => {
  const type = BOX_DEFS.find((b) => b.id === boxNumber(box))?.type
  const prices = serviceItems(catalog).filter((s) => s.boxType === type).map((s) => s.priceFrom)
  return prices.length ? Math.min(...prices) : 0
}

/* ---------- Иконки ---------- */

const ICONS: Record<string, LucideIcon> = {
  Armchair, Car, CalendarDays, Clock, Crown, Disc3, Droplets, Gem, Layers, Paintbrush, Shield, ShieldCheck,
  Sparkles, SprayCan, Sun, Truck, Wind, Wrench, Zap,
}
export const resolveIcon = (name?: string, fallback: LucideIcon = Sparkles): LucideIcon =>
  (name && ICONS[name]) || fallback
