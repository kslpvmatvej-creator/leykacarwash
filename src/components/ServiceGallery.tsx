import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import FadeImage from './FadeImage'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Props = {
  urls: string[]
  alt: string
}

const SWIPE_MIN_PX = 50
/** Сколько миниатюр показываем в ряд (совпадает с PHOTO_SLOTS) */
const THUMBS = 4

/**
 * Ряд из 4 миниатюр одинакового размера (grid-cols-4, соотношение 4:3): размеры заданы заранее,
 * подгрузка картинок не двигает страницу. Клик открывает полноэкранный просмотр (Lightbox):
 * стрелки, клавиатура, свайп, закрытие. Битые ссылки скрываются.
 */
export default function ServiceGallery({ urls, alt }: Props) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const list = urls.filter((u) => !broken.has(u))
  if (list.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-4 gap-2 px-4 pb-4 pt-0" role="list" aria-label={`Фото: ${alt}`}>
        {list.slice(0, THUMBS).map((url, i) => (
          <button
            key={url}
            type="button"
            role="listitem"
            onClick={() => setOpenIndex(i)}
            aria-label={`Открыть фото ${i + 1} из ${list.length}`}
            className="aspect-[4/3] min-w-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/10 transition active:scale-95"
          >
            <FadeImage
              key={url}
              src={url}
              alt={`${alt}, фото ${i + 1}`}
              onFail={() => setBroken((prev) => new Set(prev).add(url))}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          urls={list}
          alt={alt}
          start={Math.min(openIndex, list.length - 1)}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  )
}

type LightboxProps = {
  urls: string[]
  alt: string
  start: number
  onClose: () => void
}

function Lightbox({ urls, alt, start, onClose }: LightboxProps) {
  const [index, setIndex] = useState(start)
  const [failed, setFailed] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const count = urls.length

  const go = useCallback(
    (dir: 1 | -1) => {
      setFailed(false)
      setIndex((i) => (i + dir + count) % count)
    },
    [count]
  )

  // Клавиатура + блокировка прокрутки страницы под окном
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [go, onClose])

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current
    touchStart.current = null
    if (!s || count < 2) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // Только явно горизонтальный жест
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Фото: ${alt}`}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <X className="h-6 w-6" />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            aria-label="Предыдущее фото"
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            aria-label="Следующее фото"
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {failed ? (
        <p className="px-6 text-center text-sm text-white/70" onClick={(e) => e.stopPropagation()}>
          Не удалось загрузить фото
        </p>
      ) : (
        <img
          key={urls[index]}
          src={urls[index]}
          alt={`${alt}, фото ${index + 1} из ${count}`}
          draggable={false}
          referrerPolicy="no-referrer"
          onClick={(e) => e.stopPropagation()}
          onError={() => setFailed(true)}
          className="max-h-[85vh] max-w-full select-none object-contain"
        />
      )}

      {count > 1 && (
        <p
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tabular-nums text-white"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          {index + 1} / {count}
        </p>
      )}
    </div>,
    document.body
  )
}
