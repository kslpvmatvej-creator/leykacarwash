import { ArrowUpRight, Phone } from 'lucide-react'

import business from '../business.json'
import { BOXES } from '../lib/catalog'
import { cn } from '../lib/cn'
import { telHref } from '../lib/format'
import { plural } from '../lib/plural'
import { isValidPhotoUrl } from '../lib/guestSettings'
import { HERO_DEFAULT_PHOTO } from '../lib/siteMedia'
import { arrowShift, btnBase } from '../lib/ui'
import CarPhoto from './CarPhoto'

type Props = {
  /** Сколько боксов свободны прямо сейчас; null — занятость ещё грузится или студия закрыта */
  freeBoxes: number | null
  /** Боксов, принимающих клиентов (выключенные владельцем не считаем) */
  totalBoxes?: number
  /** Баннер, загруженный владельцем в админке; пусто — стандартный public/img/hero.jpg */
  photo?: string
  onBook: () => void
}

/** Компактный кинематографичный баннер: фото, затемнение, зерно, зеркальная кнопка «Записаться ↗» */
export default function Hero({ freeBoxes, totalBoxes, photo, onBook }: Props) {
  const boxes = totalBoxes ?? BOXES.length
  const src = photo && isValidPhotoUrl(photo) ? photo.trim() : HERO_DEFAULT_PHOTO

  return (
    <header className="relative isolate flex h-[320px] flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-zinc-950">
      <div aria-hidden className="absolute inset-0 -z-30">
        <CarPhoto key={src} src={src} fallbackSrc={HERO_DEFAULT_PHOTO} alt={business.hero.photoAlt} priority />
      </div>
      {/* Кино-затемнение: общий приглушающий слой, затем градиент и радиальная тень к низу */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-black/30" />
      <div aria-hidden className="absolute inset-0 -z-20 bg-gradient-to-t from-black via-black/35 to-transparent" />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(120%_70%_at_50%_100%,rgb(0_0_0/0.85),transparent_70%)]"
      />
      <div aria-hidden className="grain absolute inset-0 -z-10" />

      {/* Верхняя панель */}
      <div className="flex items-center justify-between p-4 md:p-6">
        <div className="glass-dark flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[13px] font-medium text-white">
            {business.shortName.charAt(0)}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-200">{business.shortName}</span>
        </div>
        <a
          href={telHref(business.phone)}
          aria-label={`Позвонить: ${business.phone}`}
          className="glass-dark flex h-10 items-center gap-2 rounded-full px-3 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white active:scale-95 md:px-4"
        >
          <Phone className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden md:inline">{business.phone}</span>
        </a>
      </div>

      {/* Заголовок слева, кнопка справа */}
      <div className="animate-rise flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between md:p-8">
        <div className="min-w-0">
          {freeBoxes !== null && (
            <p
              className={cn(
                'glass-dark mb-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs',
                freeBoxes > 0 ? 'text-emerald-300' : 'text-amber-300'
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                    freeBoxes > 0 ? 'bg-emerald-400' : 'bg-amber-400'
                  )}
                />
                <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', freeBoxes > 0 ? 'bg-emerald-400' : 'bg-amber-400')} />
              </span>
              {freeBoxes > 0
                ? `Свободно ${freeBoxes} из ${boxes} ${plural(boxes, 'бокса', 'боксов', 'боксов')}`
                : 'Все боксы заняты'}
            </p>
          )}
          <h1 className="text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-white min-[400px]:text-3xl md:text-5xl">{business.name}</h1>
          <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-zinc-400 md:text-base">{business.tagline}</p>
        </div>

        <button
          type="button"
          onClick={onBook}
          className={cn(btnBase, 'mirror h-12 shrink-0 px-7 text-[15px] font-medium text-white md:h-14')}
        >
          Записаться
          <ArrowUpRight className={arrowShift} />
        </button>
      </div>
    </header>
  )
}
