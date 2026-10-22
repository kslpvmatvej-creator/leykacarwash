import { Percent } from 'lucide-react'

import CarPhoto from './CarPhoto'
import CornerArrow from './CornerArrow'
import PhotoCarousel from './PhotoCarousel'
import StatusBadge from './StatusBadge'
import type { Box } from '../lib/catalog'
import { cn } from '../lib/cn'
import { formatPrice } from '../lib/format'
import { visiblePhotos, type GuestSettings } from '../lib/guestSettings'
import { discounted } from '../lib/settings'
import type { BoxStatus } from '../lib/availability'

type Props = {
  box: Box
  settings: GuestSettings
  /** null — занятость ещё загружается, бейдж не показываем */
  status: BoxStatus | null
  /** Глобальная скидка, % (0 — нет) */
  discountPercent: number
  /** Минимальная цена услуг бокса (из актуального прайса) */
  priceFrom: number
  /** Настройки загружены: до этого вместо обложки скелетон */
  ready: boolean
  priority?: boolean
  onBook: () => void
}

/** Компактная плитка бокса для bento-сетки: обложка, статус, название, специализация, цена «от» */
export default function BoxTile({ box, settings, status, discountPercent, priceFrom, ready, priority = false, onBook }: Props) {
  const photos = visiblePhotos(settings)
  const cover = photos[0]

  return (
    <article className="group glass hover-lift relative flex flex-col overflow-hidden rounded-3xl">
      <button
        type="button"
        onClick={onBook}
        aria-label={`Записать авто в ${box.name}`}
        className="absolute inset-0 z-10 rounded-3xl"
      />

      <div className={cn('relative h-36 bg-zinc-900', !ready && 'animate-pulse')}>
        {ready &&
          (photos.length > 1 ? (
            <PhotoCarousel key={photos.join('|')} photos={photos} alt={`${box.name}: ${box.specialty ?? ''}`} priority={priority} />
          ) : (
            <CarPhoto key={cover ?? box.id} src={cover} alt={`${box.name}: ${box.specialty ?? ''}`} priority={priority} />
          ))}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-2">
          {status ? <StatusBadge status={status} /> : <span />}
        </div>
      </div>

      <div className="pointer-events-none flex flex-1 items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight text-white">{box.name}</h3>
          {box.specialty && <p className="mt-0.5 truncate text-xs text-zinc-500">{box.specialty}</p>}
          <p className="mt-3 flex items-center gap-2 text-sm tabular-nums text-zinc-300">
            от {formatPrice(discounted(priceFrom, discountPercent))}
            {discountPercent > 0 && (
              <>
                <span className="text-zinc-600 line-through">{formatPrice(priceFrom)}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-fg">
                  <Percent className="h-2.5 w-2.5" />−{discountPercent}%
                </span>
              </>
            )}
          </p>
        </div>
        <CornerArrow />
      </div>
    </article>
  )
}
