import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import CarPhoto from './CarPhoto'
import { cn } from '../lib/cn'

type Props = { photos: string[]; alt: string; priority?: boolean }

/**
 * Свайп-галерея в обложке плитки: scroll-snap без библиотек. Грузится только первое фото,
 * остальные — лениво (CarPhoto: loading="lazy"). На ПК — стрелки.
 * Лежит поверх кнопки «записаться» (z-20), поэтому свайп работает, а тап вне фото открывает запись.
 */
export default function PhotoCarousel({ photos, alt, priority = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)

  const onScroll = () => {
    const el = ref.current
    if (el && el.clientWidth > 0) setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (ref.current?.clientWidth ?? 0), behavior: 'smooth' })

  return (
    <>
      <div
        ref={ref}
        onScroll={onScroll}
        className="absolute inset-0 z-20 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-center">
            <CarPhoto src={src} alt={`${alt}, фото ${i + 1}`} priority={priority && i === 0} />
          </div>
        ))}
      </div>

      {idx > 0 && (
        <button type="button" aria-label="Предыдущее фото" onClick={() => go(-1)} className="absolute left-2 top-1/2 z-30 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur md:flex">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {idx < photos.length - 1 && (
        <button type="button" aria-label="Следующее фото" onClick={() => go(1)} className="absolute right-2 top-1/2 z-30 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur md:flex">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 gap-1.5">
        {photos.map((src, i) => (
          <span key={src} className={cn('h-1.5 rounded-full transition-all', i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/40')} />
        ))}
      </div>
    </>
  )
}
