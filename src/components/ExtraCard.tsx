import { Minus, Plus, type LucideIcon } from 'lucide-react'

import { cn } from '../lib/cn'

type Props = {
  name: string
  priceLabel: string
  /** Сумма «цена × количество» — показываем при qty > 1 */
  sumLabel?: string
  icon: LucideIcon
  qty: number
  max: number
  /** delta: +1 / −1 для степпера, −qty — полное снятие выбора */
  onChange: (delta: number) => void
}

/**
 * Карточка допа. Размер у всех карточек одинаковый и не зависит от длины названия:
 * фиксированная высота, название ограничено двумя строками (line-clamp), цена прижата к низу,
 * степпер занимает ту же нижнюю зону, что и цена, поэтому карточка не «прыгает» при выборе.
 */
export default function ExtraCard({ name, priceLabel, sumLabel, icon: Icon, qty, max, onChange }: Props) {
  const active = qty > 0

  return (
    <div
      className={cn(
        'relative flex h-[148px] flex-col overflow-hidden rounded-2xl border transition-colors duration-200',
        active ? 'border-brand bg-brand-soft shadow-glow' : 'border-white/10 bg-white/[0.035]'
      )}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={name}
        title={name}
        onClick={() => onChange(active ? -qty : 1)}
        className="flex min-h-0 w-full flex-1 flex-col p-3.5 pb-1 text-left transition-transform duration-150 active:scale-[0.98]"
      >
        <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-brand-fg' : 'text-zinc-500')} />
        <span className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-zinc-100">{name}</span>
      </button>

      {/* Нижняя зона фиксированной высоты: цена или степпер */}
      <div className="relative h-12 shrink-0 px-2.5 pb-2.5">
        <div
          className={cn(
            'absolute inset-x-3.5 top-0 flex h-9 items-center text-sm tabular-nums text-zinc-400 transition-opacity duration-200',
            active ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
        >
          <span className="truncate">{priceLabel}</span>
        </div>

        <div
          inert={!active}
          className={cn(
            'flex h-full items-center justify-between rounded-xl bg-zinc-950/60 p-1 transition-opacity duration-200',
            active ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          title={qty > 1 && sumLabel ? `${priceLabel} × ${qty} = ${sumLabel}` : undefined}
        >
          <button
            type="button"
            onClick={() => onChange(-1)}
            aria-label={`Убрать: ${name}`}
            className="flex h-8 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-800 active:scale-90"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="flex flex-col items-center leading-none">
            <span key={qty} className="animate-tick text-base font-semibold tabular-nums text-zinc-50">
              {qty}
            </span>
            {qty > 1 && sumLabel && (
              <span className="mt-0.5 max-w-[72px] truncate text-[10px] tabular-nums text-zinc-400">{sumLabel}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onChange(1)}
            disabled={qty >= max}
            aria-label={`Добавить: ${name}`}
            className="flex h-8 w-9 items-center justify-center rounded-lg bg-brand text-brand-contrast transition active:scale-90 disabled:pointer-events-none disabled:opacity-35"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
