import { useEffect, useState } from 'react'
import { Check, ImageIcon, Loader2, TriangleAlert, Upload, X } from 'lucide-react'

import {
  BUFFER_OPTIONS,
  PHOTO_SLOTS,
  isValidPhotoUrl,
  saveGuestSettings,
  type GuestSettings,
} from '../lib/guestSettings'
import { uploadPhoto } from '../lib/upload'

type ServiceLite = { id: string; name: string; /** businesses.id бокса */ businessId: string }

type Props = {
  services: ServiceLite[]
  /** Текущие (итоговые) настройки каждого бокса */
  getSettings: (serviceId: string) => GuestSettings
  /** Вызывается после успешного сохранения */
  onSaved: (serviceId: string, s: GuestSettings) => void
}

type Draft = {
  baseGuests: string
  maxGuests: string
  extraGuestPrice: string
  cleaningBufferMin: string
  promoEnabled: boolean
  promoText: string
  promoPercent: string
  photos: string[]
}

const toDraft = (s: GuestSettings): Draft => ({
  baseGuests: String(s.baseGuests),
  maxGuests: String(s.maxGuests),
  extraGuestPrice: String(s.extraGuestPrice),
  cleaningBufferMin: String(s.cleaningBufferMin),
  promoEnabled: s.promoEnabled,
  promoText: s.promoText,
  promoPercent: s.promoPercent ? String(s.promoPercent) : '',
  photos: Array.from({ length: PHOTO_SLOTS }, (_, i) => s.photos[i] ?? ''),
})

/** Общие стили полей */
const INPUT =
  'mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2.5 text-base font-semibold text-zinc-50 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-brand'
const LABEL = 'block truncate text-[11px] font-medium text-zinc-400'

function ServiceRow({
  service,
  saved,
  onSaved,
}: {
  service: ServiceLite
  saved: GuestSettings
  onSaved: (serviceId: string, s: GuestSettings) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(saved))
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  // Если значения обновились снаружи (например, после загрузки из БД) — подтягиваем в форму
  const savedKey = JSON.stringify(saved)
  useEffect(() => {
    setDraft(toDraft(saved))
  }, [savedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved))

  const touch = () => {
    setStatus('idle')
    setError(null)
  }
  const changePhoto = (i: number, value: string) => {
    setDraft((d) => ({ ...d, photos: d.photos.map((p, idx) => (idx === i ? value : p)) }))
    touch()
  }

  /** Фото с телефона/компьютера: сжимаем в браузере, кладём в Storage, в поле подставляем ссылку */
  const pickFile = async (i: number, file: File | undefined) => {
    if (!file) return
    setUploadingIdx(i)
    setError(null)
    const res = await uploadPhoto(file, service.id)
    setUploadingIdx(null)
    if ('error' in res) setError(res.error)
    else changePhoto(i, res.url)
  }

  const save = async () => {
    const baseGuests = Number(draft.baseGuests)
    const maxGuests = Number(draft.maxGuests)
    const extraGuestPrice = Number(draft.extraGuestPrice)
    const cleaningBufferMin = Number(draft.cleaningBufferMin)
    const promoPercent = draft.promoPercent.trim() === '' ? 0 : Number(draft.promoPercent)

    if (!Number.isInteger(baseGuests) || baseGuests < 1) {
      setError('«В цене» — целое число от 1')
      return
    }
    if (!Number.isInteger(maxGuests) || maxGuests < baseGuests) {
      setError('«Максимум» должен быть целым числом и не меньше «В цене»')
      return
    }
    if (maxGuests > 100) {
      setError('«Максимум» — не больше 100')
      return
    }
    if (draft.extraGuestPrice.trim() === '' || !Number.isFinite(extraGuestPrice) || extraGuestPrice < 0) {
      setError('«Доплата» — число от 0')
      return
    }
    if (!(BUFFER_OPTIONS as readonly number[]).includes(cleaningBufferMin)) {
      setError('«Подготовка бокса» — выберите значение из списка')
      return
    }
    if (draft.promoEnabled) {
      if (!Number.isInteger(promoPercent) || promoPercent < 1 || promoPercent > 99) {
        setError('«Скидка» — целое число от 1 до 99 %')
        return
      }
    } else if (!Number.isFinite(promoPercent) || promoPercent < 0 || promoPercent > 99) {
      setError('«Скидка» — число от 0 до 99 %')
      return
    }
    if (draft.promoText.trim().length > 40) {
      setError('«Текст» акции — не длиннее 40 символов')
      return
    }
    const photos = draft.photos.map((p) => p.trim())
    const badIdx = photos.findIndex((p) => p !== '' && !isValidPhotoUrl(p))
    if (badIdx >= 0) {
      setError(`Фото ${badIdx + 1}: нужна ссылка, начинающаяся с http:// или https://`)
      return
    }

    const next: GuestSettings = {
      baseGuests,
      maxGuests,
      extraGuestPrice,
      cleaningBufferMin,
      promoEnabled: draft.promoEnabled,
      promoText: draft.promoText.trim(),
      promoPercent,
      photos,
    }
    setStatus('saving')
    setError(null)
    const err = await saveGuestSettings(service.businessId, service.id, next)
    if (err) {
      console.error(err)
      setStatus('idle')
      // 42P01 / PGRST205 — таблицы нет; 42703 / PGRST204 — нет новых колонок
      setError(
        err.code === '42P01' || err.code === 'PGRST205'
          ? 'В базе нет таблицы service_settings — выполните SQL-миграцию.'
          : err.code === '42703' || err.code === 'PGRST204'
            ? 'В service_settings нет новых колонок — выполните SQL-миграцию.'
            : 'Не удалось сохранить (нет прав или нет связи). Попробуйте ещё раз.'
      )
      return
    }
    onSaved(service.id, next)
    setStatus('ok')
  }

  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
      <p className="text-sm font-semibold leading-snug text-zinc-50">{service.name}</p>

      {/* Подготовка бокса и акции убраны: пауза между авто задаётся в business.json (prepTimeMinutes),
          скидка — глобальная, на вкладке «Маркетинг» (vladislav_settings) */}

      {/* Фото */}
      <div className="mt-3 space-y-2">
        {draft.photos.map((url, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-950 ring-1 ring-white/10">
              {isValidPhotoUrl(url) ? (
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-zinc-600" />
              )}
            </div>
            <label className="block min-w-0 flex-1">
              <span className={LABEL}>Фото {i + 1}: ссылка (или загрузите файл справа)</span>
              <input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={url}
                onChange={(e) => changePhoto(i, e.target.value)}
                placeholder="https://…"
                aria-label={`${service.name}: ссылка на фото ${i + 1}`}
                className={`${INPUT} font-medium placeholder:font-normal placeholder:text-zinc-600`}
              />
            </label>
            <label
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-zinc-800 text-zinc-100 transition active:scale-95"
              title="Загрузить фото"
            >
              {uploadingIdx === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingIdx !== null}
                onChange={(e) => {
                  void pickFile(i, e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {url && (
              <button
                type="button"
                aria-label={`Убрать фото ${i + 1}`}
                onClick={() => changePhoto(i, '')}
                className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:text-zinc-200 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!dirty || status === 'saving'}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-contrast transition active:scale-[0.98] disabled:bg-neutral-200 disabled:text-zinc-600"
      >
        {status === 'saving' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === 'ok' && !dirty ? (
          <>
            <Check className="h-4 w-4" /> Сохранено
          </>
        ) : (
          'Сохранить'
        )}
      </button>
    </div>
  )
}

/** Блок админки: подготовка бокса, акция и фото для каждого бокса */
export default function GuestSettingsEditor({ services, getSettings, onSaved }: Props) {
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs leading-relaxed text-zinc-400">
        «Подготовка бокса» — пауза после каждого автомобиля (мойка бокса, смена оснастки): она добавляется к
        концу каждой записи, в том числе многодневной. Акция уменьшает итоговую сумму на указанный процент.
        Фото — загрузите файл (сожмётся автоматически) или вставьте ссылку, до {PHOTO_SLOTS} шт. После загрузки нажмите «Сохранить».
      </p>
      {services.map((s) => (
        <ServiceRow
          key={s.id}
          service={s}
          saved={getSettings(s.id)}
          onSaved={onSaved}
        />
      ))}
    </div>
  )
}
