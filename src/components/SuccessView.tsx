import { CalendarDays, Car, Clock, MapPin, Wrench } from 'lucide-react'

export type BookingSummary = {
  /** Готовая строка: «13 октября, 12:00–13:30» (время студии) */
  whenText: string
  total: number
  serviceName: string
  vehicle: string
  vehicleClass: string
  extras: string[]
}

type Props = { summary: BookingSummary; phone: string; address: string }

/** Экран «Заявка отправлена» — показывается внутри того же bottom sheet. Бокс клиенту не показываем */
export default function SuccessView({ summary, phone, address }: Props) {
  const rows = [
    { icon: Wrench, text: summary.serviceName },
    { icon: Car, text: `${summary.vehicle} (${summary.vehicleClass})` },
    { icon: CalendarDays, text: summary.whenText },
  ]

  return (
    <div className="pt-2">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0" aria-hidden>
          <circle cx="24" cy="24" r="23" className="fill-brand" />
          <path
            d="M14 25 L21 32 L34 17"
            pathLength={1}
            strokeDasharray="1 2"
            fill="none"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw-check stroke-brand-contrast"
          />
        </svg>
        <div>
          <p className="text-xl font-semibold leading-tight tracking-tight text-zinc-50">Заявка отправлена</p>
          <p className="mt-0.5 text-sm text-zinc-400">Мастер позвонит на {phone} и подтвердит запись</p>
        </div>
      </div>

      <div className="glass mt-5 space-y-3 rounded-2xl p-4 text-sm">
        {rows.map(({ icon: Icon, text }) => (
          <p key={text} className="flex items-start gap-3 text-zinc-100">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-fg" />
            <span>{text}</span>
          </p>
        ))}
        {summary.extras.length > 0 && (
          <ul className="space-y-1 border-t border-white/10 pt-3 text-zinc-300">
            {summary.extras.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-3 border-t border-white/10 pt-3 text-zinc-400">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /> {address}
        </p>
        <p className="flex items-start gap-3 text-zinc-500">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" /> Итоговую стоимость мастер подтвердит после осмотра автомобиля
        </p>
        <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
          <span className="text-zinc-400">Ориентировочно к оплате при выдаче</span>
          <span className="text-xl font-semibold tabular-nums text-zinc-50">
            {Number(summary.total).toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>
    </div>
  )
}
