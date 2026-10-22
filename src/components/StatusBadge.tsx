import { Hourglass } from 'lucide-react'

import { cn } from '../lib/cn'
import type { BoxStatus } from '../lib/availability'

/** Индикатор статуса: зелёный пульсирует, жёлтый — занято, серый — закрыто */
export function Led({ state }: { state: BoxStatus['kind'] }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        state === 'free' && 'animate-led bg-emerald-400',
        state === 'busy' && 'bg-amber-400',
        state === 'closed' && 'bg-zinc-600'
      )}
    />
  )
}

/** Стеклянный бейдж на фото: «Свободен до 18:30» / «Занят. Свободен 14 окт с 18:30» */
export default function StatusBadge({ status }: { status: BoxStatus }) {
  return (
    <p
      aria-live="polite"
      className="glass-dark flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs text-zinc-100"
    >
      {status.kind === 'busy' ? (
        <Hourglass aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-300" />
      ) : (
        <Led state={status.kind} />
      )}
      <span className="truncate">{status.text}</span>
    </p>
  )
}
