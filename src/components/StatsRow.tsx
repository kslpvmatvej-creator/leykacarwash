import { BOXES, serviceItems } from '../lib/catalog'
import type { ServiceCatalog } from '../lib/slots'
import { formatPrice } from '../lib/format'
import { plural } from '../lib/plural'

/** Плашка: на телефоне значение над подписью (мелкий шрифт), с md — в одну строку. Длинное значение обрезается. */
function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="glass flex min-w-0 flex-col justify-center gap-1 overflow-hidden rounded-3xl px-3 py-4 min-[400px]:px-4 md:flex-row md:items-baseline md:gap-3 md:px-6 md:py-5">
      <p
        title={value}
        className="min-w-0 truncate text-base font-semibold leading-none tracking-tight text-white tabular-nums min-[400px]:text-lg md:shrink-0 md:text-3xl"
      >
        {value}
      </p>
      <p className="min-w-0 truncate text-xs text-zinc-500 md:text-sm">{label}</p>
    </div>
  )
}

/** Три горизонтальные плашки: услуги, боксы, минимальная цена */
export default function StatsRow({ services }: { services?: ServiceCatalog }) {
  const items = serviceItems(services)
  const s = items.length
  const b = BOXES.length
  const from = Math.min(...items.map((x) => x.priceFrom))

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      <Tile value={String(s)} label={plural(s, 'услуга', 'услуги', 'услуг')} />
      <Tile value={String(b)} label={plural(b, 'бокс', 'бокса', 'боксов')} />
      {/* «от» вынесено в подпись, чтобы число влезало в узкую плашку (iPhone SE) */}
      <Tile value={formatPrice(from)} label="цена от" />
    </div>
  )
}
