import { useEffect, useState } from 'react'

import business from '../business.json'
import { supabase } from '../supabaseClient'
import { isValidPhotoUrl } from './guestSettings'
import { TABLES } from './tables'

/** Баннер по умолчанию: public/img/hero.jpg (BASE_URL учитывает подпапку GitHub Pages) */
export const HERO_DEFAULT_PHOTO = `${import.meta.env.BASE_URL}img/hero.jpg`

/** Сколько фото в «Работах студии» */
export const GALLERY_SLOTS = 3

/** Фото сайта, которые владелец меняет в админке. Пустая строка — используется фото по умолчанию */
export type SiteMedia = { heroPhoto: string; gallery: string[] }

export const EMPTY_MEDIA: SiteMedia = { heroPhoto: '', gallery: Array.from({ length: GALLERY_SLOTS }, () => '') }

const GALLERY_COLS = Array.from({ length: GALLERY_SLOTS }, (_, i) => `gallery_photo_${i + 1}`)
const COLS = ['hero_photo_url', ...GALLERY_COLS].join(', ')

const CACHE_KEY = 'detailing:site-media:v1'

/** Только корректные http(s)-ссылки, остальное — пустая строка */
const clean = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return isValidPhotoUrl(s) ? s : ''
}

const normalize = (raw: { heroPhoto?: unknown; gallery?: unknown }): SiteMedia => {
  const g = Array.isArray(raw.gallery) ? raw.gallery : []
  return {
    heroPhoto: clean(raw.heroPhoto),
    gallery: Array.from({ length: GALLERY_SLOTS }, (_, i) => clean(g[i])),
  }
}

const readCache = (): SiteMedia | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? normalize(JSON.parse(raw) as SiteMedia) : null
  } catch {
    return null
  }
}

const writeCache = (m: SiteMedia) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(m))
  } catch {
    /* хранилище недоступно — не критично */
  }
}

/**
 * Читает фото сайта из таблицы настроек владельца. null — запрос не удался
 * (нет колонок / сеть): тогда сайт показывает фото по умолчанию.
 */
export async function loadSiteMedia(): Promise<SiteMedia | null> {
  const { data, error } = await supabase
    .from(TABLES.settings)
    .select(COLS)
    .eq('business_id', business.businessId)
    .maybeSingle()
  if (error) {
    console.warn('Фото сайта недоступны (выполните supabase/site-media.sql)', error.message)
    return null
  }
  if (!data) return EMPTY_MEDIA
  const r = data as unknown as Record<string, unknown>
  return normalize({ heroPhoto: r.hero_photo_url, gallery: GALLERY_COLS.map((c) => r[c]) })
}

/** Сохраняет только переданные поля (upsert). Пустая строка сбрасывает фото на стандартное. Возвращает текст ошибки или null */
export async function saveSiteMedia(patch: Partial<SiteMedia>): Promise<string | null> {
  const row: Record<string, unknown> = { business_id: business.businessId }
  if (patch.heroPhoto !== undefined) row.hero_photo_url = patch.heroPhoto.trim() || null
  if (patch.gallery) {
    GALLERY_COLS.forEach((col, i) => {
      row[col] = patch.gallery![i]?.trim() || null
    })
  }
  const { error } = await supabase.from(TABLES.settings).upsert(row, { onConflict: 'business_id' })
  if (error) {
    console.error(error)
    if (error.code === '42501') return 'Нет прав: войдите как владелец.'
    if (error.code === '42703' || error.code === 'PGRST204')
      return 'В таблице настроек нет колонок для фото сайта — выполните supabase/site-media.sql.'
    return 'Не удалось сохранить (нет прав или нет связи). Попробуйте ещё раз.'
  }
  writeCache(normalize({ heroPhoto: patch.heroPhoto, gallery: patch.gallery }))
  return null
}

/**
 * Для клиентской части: фото из админки. Кэшируются в localStorage — при обновлении страницы
 * картинки известны сразу, без «прыжка» со стандартного фото на загруженное.
 */
export function useSiteMedia() {
  const [media, setMedia] = useState<SiteMedia>(() => readCache() ?? EMPTY_MEDIA)
  const [loaded, setLoaded] = useState(() => readCache() !== null)

  useEffect(() => {
    let cancelled = false
    void loadSiteMedia().then((m) => {
      if (cancelled) return
      if (m) {
        setMedia(m)
        writeCache(m)
      }
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { media, loaded }
}
