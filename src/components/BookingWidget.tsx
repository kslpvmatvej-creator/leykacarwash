import { ArrowUpRight, Clock, MapPin, MessageCircle, Phone, Send } from 'lucide-react'

import business from '../business.json'
import { BOXES } from '../lib/catalog'
import { cn } from '../lib/cn'
import { telHref } from '../lib/format'
import { plural } from '../lib/plural'
import { arrowShift, arrowShiftSm, btnGlassSm, btnNeon } from '../lib/ui'
import { Led } from './StatusBadge'

type Props = {
  /** Сколько боксов свободны сейчас; null — занятость ещё грузится или студия закрыта */
  freeBoxes: number | null
  /** Сколько боксов сейчас принимает клиентов (выключенные владельцем не считаем) */
  totalBoxes?: number
  onBook: () => void
}

/** Виджет «Запись в студию»: на десктопе залипает при скролле, на телефоне стоит в конце страницы */
export default function BookingWidget({ freeBoxes, totalBoxes, onBook }: Props) {
  const total = totalBoxes ?? BOXES.length

  return (
    <section
      id="booking"
      aria-labelledby="booking-title"
      className="glass flex min-w-0 scroll-mt-4 flex-col gap-4 rounded-3xl p-5 lg:sticky lg:top-4"
    >
      <div>
        <h2 id="booking-title" className="text-xl font-semibold tracking-tight text-white">
          Запись в студию
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Выберите услугу и время — свободный бокс подберём сами.</p>
      </div>

      {freeBoxes !== null && (
        <p className="flex h-12 items-center gap-2.5 rounded-2xl border border-white/5 bg-white/[0.03] px-4 text-sm text-zinc-200">
          <Led state={freeBoxes > 0 ? 'free' : 'busy'} />
          <span className="min-w-0 truncate">
            {freeBoxes > 0
              ? `Свободно ${freeBoxes} из ${total} ${plural(total, 'бокса', 'боксов', 'боксов')}`
              : 'Сейчас все боксы заняты'}
          </span>
        </p>
      )}

      <button type="button" onClick={onBook} className={cn(btnNeon, 'h-14 w-full')}>
        Записать авто
        <ArrowUpRight className={arrowShift} />
      </button>

      {/* Контакты: все строки с одинаковым ритмом py-3, текст выровнен по левому краю p-5 */}
      <div className="border-t border-white/5">
        <ul className="divide-y divide-white/5 text-sm text-zinc-300">
          <li className="flex items-center gap-3 py-3">
            <Clock className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
            <span className="min-w-0">
              Ежедневно с {business.workingHours.open} до {business.workingHours.close}
            </span>
          </li>
          <li className="flex items-start gap-3 py-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
            <span className="min-w-0 break-words">{business.address}</span>
          </li>
          <li>
            <a href={telHref(business.phone)} className="flex items-center gap-3 py-3 font-medium text-white">
              <Phone className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
              <span className="min-w-0 truncate">{business.phone}</span>
            </a>
          </li>
        </ul>

        {/* Ровно по 50%: grid-cols-2 = два столбца minmax(0,1fr) независимо от длины подписи */}
        <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
          <a
            href={`https://t.me/${business.contacts.telegram}`}
            target="_blank"
            rel="noreferrer"
            className={cn(btnGlassSm, 'h-12 min-w-0 whitespace-nowrap')}
          >
            <Send className="h-4 w-4 shrink-0" strokeWidth={1.75} /> Telegram
            <ArrowUpRight className={cn(arrowShiftSm, 'hidden shrink-0 min-[360px]:block')} />
          </a>
          <a
            href={`https://wa.me/${business.contacts.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className={cn(btnGlassSm, 'h-12 min-w-0 whitespace-nowrap')}
          >
            <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} /> WhatsApp
            <ArrowUpRight className={cn(arrowShiftSm, 'hidden shrink-0 min-[360px]:block')} />
          </a>
        </div>
      </div>
    </section>
  )
}
