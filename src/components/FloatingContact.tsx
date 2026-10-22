import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Phone, Send, X, type LucideIcon } from 'lucide-react'

import business from '../business.json'
import { cn } from '../lib/cn'
import { telHref } from '../lib/format'

type Props = {
  /** Шторка записи открыта: кнопку прячем, чтобы не мешала */
  hidden: boolean
}

const links: { label: string; href: string; icon: LucideIcon; external?: boolean }[] = [
  { label: 'Telegram', href: `https://t.me/${business.contacts.telegram}`, icon: Send, external: true },
  { label: 'WhatsApp', href: `https://wa.me/${business.contacts.whatsapp}`, icon: MessageCircle, external: true },
  { label: 'Позвонить', href: telHref(business.phone), icon: Phone },
]

/** Круглая стеклянная кнопка связи в углу: по клику раскрывает Telegram / WhatsApp / звонок */
export default function FloatingContact({ hidden }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const gone = hidden
  const shown = open && !gone

  return (
    <div
      ref={root}
      inert={gone}
      className={cn(
        // На телефоне встаёт над таблеткой навигации, на десктопе — в самом углу
        'fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 transition-[opacity,translate] duration-300 lg:bottom-6 lg:right-6',
        gone ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
      )}
    >
      <div
        id="contact-menu"
        inert={!shown}
        className={cn(
          'w-52 origin-bottom-right rounded-3xl border border-white/10 bg-zinc-900/60 p-1.5 shadow-2xl backdrop-blur-2xl transition-[opacity,scale] duration-200',
          shown ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        )}
      >
        {links.map(({ label, href, icon: Icon, external }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
            onClick={() => setOpen(false)}
            className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.06]"
          >
            <Icon className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            {label}
          </a>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={shown}
        aria-controls="contact-menu"
        aria-label={shown ? 'Закрыть контакты' : 'Связаться с нами'}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-zinc-900/60 text-white shadow-2xl backdrop-blur-2xl transition hover:border-white/25 active:scale-95"
      >
        {shown ? <X className="h-5 w-5" strokeWidth={1.75} /> : <MessageCircle className="h-6 w-6" strokeWidth={1.75} />}
      </button>
    </div>
  )
}
