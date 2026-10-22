import { useState } from 'react'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'

import { isValidPhotoUrl } from '../lib/guestSettings'
import { uploadPhoto } from '../lib/upload'
import { cn } from '../lib/cn'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  /** Подпапка в Storage: photos/<businessId>/<folder>/… */
  folder: string
  /** Текст ошибки загрузки (null — сбросить) */
  onError: (message: string | null) => void
  /** Что видно на сайте, пока своё фото не загружено */
  defaultPreview?: string
  /** Крупное превью над полем (для баннера) */
  large?: boolean
}

const INPUT =
  'mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2.5 text-base font-medium text-zinc-50 outline-none ring-1 ring-white/10 placeholder:font-normal placeholder:text-zinc-600 focus:ring-2 focus:ring-brand'

/**
 * Поле фото как в блоке боксов: превью, ссылка и кнопка загрузки файла.
 * Файл сжимается в браузере и кладётся в Supabase Storage (uploadPhoto), в поле подставляется публичная ссылка.
 */
export default function PhotoField({ label, value, onChange, folder, onError, defaultPreview, large = false }: Props) {
  const [uploading, setUploading] = useState(false)
  const own = isValidPhotoUrl(value)
  const preview = own ? value.trim() : defaultPreview

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    onError(null)
    const res = await uploadPhoto(file, folder)
    setUploading(false)
    if ('error' in res) onError(res.error)
    else onChange(res.url)
  }

  return (
    <div>
      {large && (
        <div className="relative mb-2 aspect-[16/7] w-full overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-white/10">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-zinc-600" />
          )}
          {!own && preview && (
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-zinc-300">
              Стандартное фото
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        {!large && (
          <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-950 ring-1 ring-white/10">
            {preview ? (
              <img src={preview} alt="" loading="lazy" className={cn('h-full w-full object-cover', !own && 'opacity-50')} />
            ) : (
              <ImageIcon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-zinc-600" />
            )}
          </div>
        )}
        <label className="block min-w-0 flex-1">
          <span className="block truncate text-[11px] font-medium text-zinc-400">{label}: ссылка (или загрузите файл справа)</span>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              onError(null)
            }}
            placeholder="https://…"
            aria-label={`${label}: ссылка на фото`}
            className={INPUT}
          />
        </label>
        <label
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-zinc-800 text-zinc-100 transition active:scale-95"
          title="Загрузить фото"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void pickFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            aria-label={`${label}: убрать фото`}
            title="Вернуть стандартное фото"
            onClick={() => onChange('')}
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:text-zinc-200 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
