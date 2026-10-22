import { useState } from 'react'

import { cn } from '../lib/cn'

type Props = {
  src: string
  alt: string
  className?: string
  /** Подставляется один раз, если основная ссылка не загрузилась */
  fallbackSrc?: string
  /** Первый экран: грузить в первую очередь */
  priority?: boolean
  /** Вызывается, когда картинка (и запасная) не загрузилась */
  onFail?: () => void
}

/**
 * Картинка без «прыжка» при загрузке: пока файла нет — мягкая заглушка-шиммер,
 * после загрузки плавно проявляется. Уже закэшированные картинки показываются сразу.
 * Ставьте key={src}, чтобы состояние сбрасывалось при смене ссылки.
 */
export default function FadeImage({ src, alt, className, fallbackSrc, priority = false, onFail }: Props) {
  const [current, setCurrent] = useState(src)
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-900">
      {!loaded && <div aria-hidden className="absolute inset-0 animate-pulse bg-zinc-800/60" />}
      <img
        ref={(el) => {
          // Картинка уже в кэше браузера — показываем без анимации
          if (el && el.complete && el.naturalWidth > 0) setLoaded(true)
        }}
        src={current}
        alt={alt}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc)
          else onFail?.()
        }}
        className={cn(className, 'transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}
