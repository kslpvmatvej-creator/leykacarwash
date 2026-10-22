import { useState } from 'react'
import { Car } from 'lucide-react'

import { cn } from '../lib/cn'

type Props = {
  src?: string
  /** Подставляется один раз, если основная ссылка не загрузилась (например, стандартное фото) */
  fallbackSrc?: string
  alt: string
  className?: string
  /** Первый экран: грузить в первую очередь */
  priority?: boolean
}

/**
 * Фото автомобиля для карточек и Hero: проявляется после загрузки, а если ссылка не открылась
 * (или фото не задано) — вместо пустоты показывает графитовую «металлическую» заглушку.
 * Ставьте key={src}, чтобы состояние сбрасывалось при смене ссылки.
 */
export default function CarPhoto({ src, fallbackSrc, alt, className, priority = false }: Props) {
  const [current, setCurrent] = useState(src)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(!src)

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-graphite-900', className)}>
      {/* Металлик под фото: виден, пока оно грузится, и вместо него при ошибке */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,#2a2a32_0%,#0e0e11_55%,#000_100%)]"
      />
      {(failed || !loaded) && (
        <Car
          aria-hidden
          strokeWidth={1}
          className={cn(
            'absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-white/10',
            !failed && 'animate-pulse'
          )}
        />
      )}
      {!failed && (
        <img
          ref={(el) => {
            // Картинка уже в кэше браузера — показываем без анимации
            if (el && el.complete && el.naturalWidth > 0) setLoaded(true)
          }}
          src={current}
          alt={alt}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc)
            else setFailed(true)
          }}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700',
            loaded ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
          )}
        />
      )}
    </div>
  )
}
