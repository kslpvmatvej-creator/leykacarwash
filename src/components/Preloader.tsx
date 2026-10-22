import { useEffect, useState } from 'react'

import business from '../business.json'
import { cn } from '../lib/cn'

type Props = {
  /** true — данные ещё грузятся, экран загрузки показан */
  loading: boolean
}

/** Минимум, сколько экран висит, чтобы не мелькать на быстрой сети */
const MIN_VISIBLE_MS = 700
/** Длительность исчезновения (совпадает с duration-500 ниже) */
const FADE_MS = 500

/**
 * Экран загрузки при первом открытии: чёрный фон, логотип-буква с вращающимся кольцом в цвет бренда,
 * название и бегущая полоска. Когда данные подтянулись, плавно растворяется и убирается из DOM.
 */
export default function Preloader({ loading }: Props) {
  const [mountedAt] = useState(() => Date.now())
  const [minPassed, setMinPassed] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setMinPassed(true), MIN_VISIBLE_MS)
    return () => window.clearTimeout(t)
  }, [mountedAt])

  const hiding = !loading && minPassed

  useEffect(() => {
    if (!hiding) return
    const t = window.setTimeout(() => setGone(true), FADE_MS)
    return () => window.clearTimeout(t)
  }, [hiding])

  // Пока виден, блокируем прокрутку страницы под ним
  useEffect(() => {
    if (gone) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [gone])

  if (gone) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Загрузка"
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-500',
        hiding ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
    >
      {/* Мягкое свечение за логотипом */}
      <div
        aria-hidden
        className="animate-loader-glow absolute h-72 w-72 rounded-full bg-brand/30 blur-3xl"
      />

      <div className="relative flex h-24 w-24 items-center justify-center">
        <div aria-hidden className="absolute inset-0 rounded-full border border-white/10" />
        <div
          aria-hidden
          className="animate-spin-slow absolute inset-0 rounded-full border-2 border-transparent border-t-brand border-r-brand/40"
        />
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-2xl font-semibold text-white">
          {business.shortName.charAt(0)}
        </span>
      </div>

      <p className="relative mt-8 text-xs font-medium uppercase tracking-[0.36em] text-zinc-200">{business.shortName}</p>
      <p className="relative mt-2 text-[11px] tracking-wide text-zinc-500">{business.name}</p>

      <div aria-hidden className="relative mt-8 h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
        <div className="animate-loader-bar h-full w-2/5 rounded-full bg-brand" />
      </div>
    </div>
  )
}
