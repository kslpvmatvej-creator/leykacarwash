import { ArrowUpRight } from 'lucide-react'

import { cn } from '../lib/cn'

/**
 * Круглая «стрелка в угол» для интерактивных карточек.
 * Родитель должен иметь класс `group`: при наведении рамка и иконка окрашиваются в цвет бренда.
 */
export default function CornerArrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition-colors duration-300 group-hover:border-brand/50 group-hover:bg-brand-soft group-hover:text-brand-fg',
        className
      )}
    >
      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-px group-hover:-translate-y-px" />
    </span>
  )
}
