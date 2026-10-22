import business from '../business.json'
import { supabase } from '../supabaseClient'

/** Публичный бакет Supabase Storage (создаётся в supabase/schema.sql) */
export const PHOTO_BUCKET = 'photos'

/** Длинная сторона после сжатия и качество: фото ≈ 80–200 КБ вместо 3–8 МБ с телефона */
const MAX_SIDE = 1400
const QUALITY = 0.82
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** Уменьшает фото до MAX_SIDE и перекодирует в WebP (если браузер не умеет — в JPEG) */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas недоступен')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let blob = await toBlob(canvas, 'image/webp', QUALITY)
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', QUALITY)
  if (!blob) throw new Error('не удалось сжать фото')
  return blob
}

export type UploadResult = { url: string } | { error: string }

/** Сжимает фото и загружает в Storage: photos/<businessId>/<папка>/<время>-<случайное>.webp. Возвращает публичную ссылку */
export async function uploadPhoto(file: File, folder: string): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) return { error: 'Нужен файл-картинка (JPG, PNG, WebP, HEIC).' }
  if (file.size > MAX_SOURCE_BYTES) return { error: 'Файл слишком большой (больше 25 МБ).' }

  let blob: Blob
  try {
    blob = await compressImage(file)
  } catch (e) {
    console.error(e)
    return { error: 'Не удалось обработать картинку. Попробуйте JPG или PNG.' }
  }

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '')
  const path = `${business.businessId}/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // файл не меняется (имя уникальное) — браузер и CDN кэшируют на год
    upsert: false,
  })
  if (error) {
    console.error(error)
    return {
      error: /bucket not found/i.test(error.message)
        ? 'В Supabase нет хранилища «photos» — выполните supabase/schema.sql.'
        : 'Не удалось загрузить фото (нет прав или нет связи). Войдите как владелец и повторите.',
    }
  }
  return { url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl }
}
