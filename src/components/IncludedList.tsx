import { Check } from 'lucide-react'

import { cn } from '../lib/cn'

type Props = { items: string[]; className?: string; columns?: boolean }

/** Список «Что входит в услугу»: галочка + пункт. Только span-ы — безопасно внутри кнопок. columns — две колонки на широком экране */
export default function IncludedList({ items, className, columns = false }: Props) {
  if (items.length === 0) return null
  return (
    <span role="list" className={cn('grid gap-x-6 gap-y-1.5', columns && 'md:grid-cols-2', className)}>
      {items.map((t, i) => (
        <span key={i} role="listitem" className="flex items-start gap-2 text-[13px] leading-snug text-zinc-300">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-fg ring-1 ring-white/10">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          <span className="min-w-0">{t}</span>
        </span>
      ))}
    </span>
  )
}
