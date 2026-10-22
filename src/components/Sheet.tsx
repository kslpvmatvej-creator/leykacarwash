import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  children: ReactNode
}

const CLOSE_MS = 220
const DISMISS_PX = 110

/** Ширина, с которой шторка превращается в центрированное окно (совпадает с брейкпоинтом md в Tailwind) */
const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * Мобильный: bottom sheet — выезжает снизу, закрывается свайпом вниз за шапку, по тапу на фон и по Esc.
 * Десктоп (md+): то же содержимое в виде центрированного окна max-w-2xl с мягким появлением.
 * Фон страницы не скроллится, нижний отступ учитывает «чёлку» iOS (safe-area).
 */
export default function Sheet({ open, onClose, title, description, footer, children }: Props) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef<number | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Всегда актуальный onClose без пересоздания close(): иначе эффект ниже
  // перезапускался на каждый ввод символа и возвращал фокус с инпута на панель.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    window.setTimeout(() => {
      closingRef.current = false
      setClosing(false)
      setDragY(0)
      onCloseRef.current()
    }, CLOSE_MS)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  if (!open) return null

  const onDown = (e: React.PointerEvent) => {
    if (window.matchMedia(DESKTOP_QUERY).matches) return // на десктопе окно не «тянется»
    startY.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (startY.current === null) return
    setDragY(Math.max(0, e.clientY - startY.current))
  }
  const onUp = () => {
    if (startY.current === null) return
    startY.current = null
    setDragging(false)
    if (dragY > DISMISS_PX) close()
    else setDragY(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/75 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ '--drag': `${dragY}px`, transform: dragY ? `translateY(${dragY}px)` : undefined } as CSSProperties}
        className={`relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border-x border-t border-white/10 bg-zinc-950/95 shadow-[0_-20px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl outline-none md:max-h-[88dvh] md:max-w-2xl md:rounded-3xl md:border md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95)] ${
          closing ? 'animate-sheet-down md:animate-modal-out' : 'animate-sheet-up md:animate-modal-in'
        } ${dragging ? '' : 'transition-transform duration-200'}`}
      >
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="shrink-0 cursor-grab touch-none px-4 pb-3 pt-2.5 active:cursor-grabbing md:cursor-default md:px-6 md:pt-5"
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700 md:hidden" />
          <div className="mt-3 flex items-start justify-between gap-3 md:mt-0">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight tracking-tight text-zinc-50">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-zinc-400">{description}</p>}
            </div>
            <button
              type="button"
              onClick={close}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Закрыть"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 md:px-6">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-white/10 bg-black/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:rounded-b-3xl md:px-6 md:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
