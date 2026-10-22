import { useMemo, useState } from 'react'
import { ChevronDown, Clock, Sparkles } from 'lucide-react'

import CornerArrow from './CornerArrow'
import IncludedList from './IncludedList'
import type { ServiceCatalog, ServiceId } from '../lib/slots'
import { resolveIcon, serviceCategories, serviceItems, splitIncluded } from '../lib/catalog'
import { cn } from '../lib/cn'
import { formatPrice } from '../lib/format'
import { discounted } from '../lib/settings'

const ALL = 'all'

/** «1 ч 30 мин» для диапазона: от самой короткой до самой долгой длительности по классам авто */
const durationRange = (services: ServiceCatalog, id: ServiceId) => {
  const v = Object.values(services[id].durationMin)
  const f = (m: number) => `${Math.floor(m / 60) ? `${Math.floor(m / 60)} ч` : ''}${m % 60 ? ` ${m % 60} мин` : ''}`.trim()
  const lo = Math.min(...v)
  const hi = Math.max(...v)
  return lo === hi ? f(lo) : `${f(lo)} – ${f(hi)}`
}

type Props = {
  /** Клик по строке: открывает шторку записи с этой услугой */
  onBook: (serviceId: ServiceId) => void
  /** Глобальная скидка, % (0 — нет): старая цена зачёркивается, рядом новая */
  discountPercent: number
  /** Актуальный прайс (vladislav_settings.services_config или каталог по умолчанию) */
  services: ServiceCatalog
}

/** Прайс таблицей: одна строка на услугу, фильтр по категории чипами */
export default function ServiceTable({ onBook, discountPercent, services }: Props) {
  const [category, setCategory] = useState<string>(ALL)
  const [openId, setOpenId] = useState<string | null>(null)
  const CATEGORIES = useMemo(() => serviceCategories(services), [services])
  const rows = useMemo(() => {
    const list = serviceItems(services)
    return category === ALL ? list : list.filter((s) => s.category === category)
  }, [category, services])

  return (
    <section id="services" className="scroll-mt-4" aria-labelledby="services-title">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-baseline gap-3 px-1">
          <h2 id="services-title" className="text-xl font-semibold tracking-tight text-white">
            Услуги
          </h2>
          <p className="text-xs text-zinc-500">Цена для седана, для других классов — при записи</p>
        </div>

        {CATEGORIES.length > 1 && (
          <div
            role="tablist"
            aria-label="Категории услуг"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {[ALL, ...CATEGORIES].map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition active:scale-95',
                  category === c
                    ? 'border-white bg-white text-black'
                    : 'border-white/5 bg-zinc-900/40 text-zinc-400 hover:border-white/15 hover:text-white'
                )}
              >
                {c === ALL ? 'Все' : c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="glass overflow-hidden rounded-3xl">
        <div className="hidden grid-cols-[2.25rem_1fr_11rem_9rem_2rem] items-center gap-x-4 border-b border-white/5 px-5 py-3 text-[11px] text-zinc-500 md:grid">
          <span />
          <span>Услуга</span>
          <span>Срок</span>
          <span className="text-right">От</span>
          <span />
        </div>

        <ul className="divide-y divide-white/5">
          {rows.map((s) => {
            const Icon = resolveIcon(s.icon)
            const now = discounted(s.priceFrom, discountPercent)
            const included = splitIncluded(s.description)
            const open = openId === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onBook(s.id)}
                  className="group grid w-full grid-cols-[2.25rem_1fr_auto] items-center gap-x-4 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-white/[0.04] md:grid-cols-[2.25rem_1fr_11rem_9rem_2rem] md:px-5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-white/[0.04] text-zinc-300 transition-colors group-hover:text-brand-fg">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-white">{s.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 md:hidden">
                      <Clock className="h-3.5 w-3.5" />
                      {durationRange(services, s.id)}
                    </span>
                  </span>

                  <span className="hidden items-center gap-1.5 text-sm text-zinc-400 md:flex">
                    <Clock className="h-3.5 w-3.5 text-zinc-500" />
                    {durationRange(services, s.id)}
                  </span>

                  <span className="text-right tabular-nums">
                    {discountPercent > 0 && (
                      <span className="block text-xs text-zinc-500 line-through">{formatPrice(s.priceFrom)}</span>
                    )}
                    <span className={cn('block text-[15px] font-semibold', discountPercent > 0 ? 'text-brand-fg' : 'text-white')}>
                      {formatPrice(now)}
                    </span>
                  </span>

                  <CornerArrow className="hidden md:flex" />
                </button>

                {included.length > 0 && (
                  <div className="px-4 pb-3 md:pl-[4.25rem] md:pr-5">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : s.id)}
                      aria-expanded={open}
                      aria-controls={`included-${s.id}`}
                      className="flex items-center gap-1.5 rounded-full py-1 text-xs font-medium text-brand-fg transition active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Что входит · {included.length}
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', open && 'rotate-180')} />
                    </button>
                    <div
                      id={`included-${s.id}`}
                      className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-2 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5">
                          <IncludedList items={included} columns />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
