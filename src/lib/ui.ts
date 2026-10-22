/**
 * Единая шкала форм и кнопок.
 *  — контейнеры (карточки, панели, шторки): rounded-3xl
 *  — управляющие элементы (кнопки, поля, плитки выбора): rounded-2xl
 *  — чипы, бейджи, круглые иконки: rounded-full
 */

export const btnBase =
  'group/btn interactive inline-flex items-center justify-center gap-2 rounded-2xl tracking-tight select-none disabled:pointer-events-none'

/** Основная кнопка (высоту задаёт место использования: h-14 / h-12): бренд-заливка, тонкий верхний блик вместо тяжёлой тени */
export const btnPrimary = `${btnBase} bg-brand text-[15px] font-semibold text-brand-contrast shadow-[inset_0_1px_0_rgb(255_255_255/0.28)] hover:brightness-110 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none`

/** Вторичная кнопка: стекло и линия border-white/10 */
export const btnGlass = `${btnBase} glass text-[15px] font-medium text-white hover:bg-white/[0.07]`

/** Компактная вторичная кнопка (контакты, действия в карточках) */
export const btnGlassSm = `${btnBase} glass text-sm font-medium text-white hover:bg-white/[0.07]`

/** Стрелка ↗ внутри кнопки: сдвигается в угол при наведении на кнопку */
export const arrowShift = 'h-[18px] w-[18px] transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5'

export const arrowShiftSm = 'h-4 w-4 text-zinc-500 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5'

/** Акцентная кнопка записи в виджете: blue-500 с неоновым свечением */
export const btnNeon = `${btnBase} neon bg-brand text-[15px] font-semibold text-brand-contrast hover:brightness-110`
