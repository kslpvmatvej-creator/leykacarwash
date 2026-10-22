import { useEffect, useState } from 'react'
import { CalendarDays, House, LayoutGrid, type LucideIcon } from 'lucide-react'

import { cn } from '../lib/cn'

type Tab = 'home' | 'services' | 'booking'

type Props = {
  /** Шторка записи открыта: «Моя запись» подсвечена, сама таблетка уходит вниз */
  bookingOpen: boolean
  onBooking: () => void
}

const ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'services', label: 'Услуги', icon: LayoutGrid },
  { id: 'booking', label: 'Моя запись', icon: CalendarDays },
]

/**
 * Плавающая «таблетка» внизу экрана (только телефон).
 * Активная вкладка определяется по тому, какой блок сейчас в центре экрана.
 */
export default function PillNav({ bookingOpen, onBooking }: Props) {
  const [section, setSection] = useState<Exclude<Tab, 'booking'>>('home')

  useEffect(() => {
    const targets: [Exclude<Tab, 'booking'>, HTMLElement][] = []
    for (const id of ['home', 'services'] as const) {
      const el = document.getElementById(id)
      if (el) targets.push([id, el])
    }

    // Узкая полоса по центру экрана: блок, который её пересекает, считается текущим
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const hit = targets.find(([, el]) => el === e.target)
          if (hit) setSection(hit[0])
        }
      },
      { rootMargin: '-48% 0px -48% 0px' }
    )
    targets.forEach(([, el]) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const active: Tab = bookingOpen ? 'booking' : section

  const go = (id: Tab) => {
    if (id === 'booking') return onBooking()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior = reduce ? 'auto' : 'smooth'
    if (id === 'home') window.scrollTo({ top: 0, behavior })
    else document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' })
  }

  return (
    <nav
      aria-label="Навигация"
      inert={bookingOpen}
      className={cn(
        // w-max: у fixed-элемента с left-1/2 доступная ширина — всего 50vw, из-за чего пункты сжимались.
        // Теперь таблетка берёт ширину по содержимому, но не шире экрана.
        'fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 lg:hidden',
        'flex items-center justify-center gap-5 rounded-full border border-white/10 bg-zinc-900/60 px-5 py-3 shadow-2xl backdrop-blur-2xl min-[380px]:gap-6 min-[380px]:px-6',
        'transition-[opacity,translate] duration-300 ease-out',
        bookingOpen ? 'translate-y-6 opacity-0' : 'translate-y-0 opacity-100'
      )}
    >
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const on = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'flex shrink-0 flex-col items-center gap-1 transition-colors duration-300 active:scale-95',
              on ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <Icon
              className={cn('h-5 w-5 shrink-0 transition-[filter] duration-300', on && 'drop-shadow-[0_0_8px_rgb(255_255_255/0.85)]')}
              strokeWidth={on ? 2 : 1.75}
            />
            <span className="whitespace-nowrap text-[10px] font-medium leading-none">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
