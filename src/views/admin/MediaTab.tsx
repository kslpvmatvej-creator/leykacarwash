import { useEffect, useState, type ReactNode } from 'react'
import { Check, Loader2, TriangleAlert } from 'lucide-react'

import PhotoField from '../../components/PhotoField'
import business from '../../business.json'
import { isValidPhotoUrl } from '../../lib/guestSettings'
import {
  EMPTY_MEDIA,
  GALLERY_SLOTS,
  HERO_DEFAULT_PHOTO,
  loadSiteMedia,
  saveSiteMedia,
  type SiteMedia,
} from '../../lib/siteMedia'

const WORKS = (business.gallery ?? []) as { photo: string; caption: string }[]

/** Карточка блока: заголовок, поля, ошибка и кнопка «Сохранить» */
function Card({
  title,
  hint,
  error,
  dirty,
  status,
  onSave,
  children,
}: {
  title: string
  hint: string
  error: string | null
  dirty: boolean
  status: 'idle' | 'saving' | 'ok'
  onSave: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="font-semibold text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-400">{hint}</p>
      <div className="mt-4 space-y-4">{children}</div>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || status === 'saving'}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-contrast transition active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-500"
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
    </section>
  )
}

function HeroCard({ saved, onSaved }: { saved: string; onSaved: (v: string) => void }) {
  const [value, setValue] = useState(saved)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok'>('idle')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const v = value.trim()
    if (v !== '' && !isValidPhotoUrl(v)) {
      setError('Нужна ссылка, начинающаяся с http:// или https://')
      return
    }
    setStatus('saving')
    setError(null)
    const err = await saveSiteMedia({ heroPhoto: v })
    if (err) {
      setStatus('idle')
      setError(err)
      return
    }
    setValue(v)
    onSaved(v)
    setStatus('ok')
  }

  return (
    <Card
      title="Главный баннер"
      hint="Большое фото в верхней части сайта. Лучше горизонтальное, от 1400 px по ширине. Загрузите файл (сожмётся автоматически) или вставьте ссылку, затем нажмите «Сохранить». Крестик возвращает стандартный баннер."
      error={error}
      dirty={value.trim() !== saved}
      status={status}
      onSave={() => void save()}
    >
      <PhotoField
        large
        label="Баннер"
        value={value}
        onChange={(v) => {
          setValue(v)
          setStatus('idle')
        }}
        folder="site"
        onError={setError}
        defaultPreview={HERO_DEFAULT_PHOTO}
      />
    </Card>
  )
}

function GalleryCard({ saved, onSaved }: { saved: string[]; onSaved: (v: string[]) => void }) {
  const [values, setValues] = useState(saved)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok'>('idle')
  const [error, setError] = useState<string | null>(null)

  const trimmed = values.map((v) => v.trim())

  const save = async () => {
    const bad = trimmed.findIndex((v) => v !== '' && !isValidPhotoUrl(v))
    if (bad >= 0) {
      setError(`Фото ${bad + 1}: нужна ссылка, начинающаяся с http:// или https://`)
      return
    }
    setStatus('saving')
    setError(null)
    const err = await saveSiteMedia({ gallery: trimmed })
    if (err) {
      setStatus('idle')
      setError(err)
      return
    }
    setValues(trimmed)
    onSaved(trimmed)
    setStatus('ok')
  }

  return (
    <Card
      title="Работы студии"
      hint={`${GALLERY_SLOTS} фото в разделе «Работы студии»: первое показывается широким, два других квадратными. Загрузите файл или вставьте ссылку и нажмите «Сохранить». Крестик возвращает стандартное фото.`}
      error={error}
      dirty={JSON.stringify(trimmed) !== JSON.stringify(saved)}
      status={status}
      onSave={() => void save()}
    >
      {values.map((v, i) => (
        <PhotoField
          key={i}
          label={`Фото ${i + 1}${WORKS[i] ? ` («${WORKS[i].caption}»)` : ''}`}
          value={v}
          onChange={(next) => {
            setValues((prev) => prev.map((p, idx) => (idx === i ? next : p)))
            setStatus('idle')
          }}
          folder="site"
          onError={setError}
          defaultPreview={WORKS[i]?.photo}
        />
      ))}
    </Card>
  )
}

/** Вкладка «Фото сайта»: главный баннер и фотографии галереи работ (загрузка в Supabase Storage) */
export default function MediaTab() {
  const [media, setMedia] = useState<SiteMedia | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void loadSiteMedia().then((m) => {
      if (cancelled) return
      setMedia(m)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-fg" />
      </div>
    )
  }
  if (!media) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Не удалось загрузить фото сайта. Проверьте, что в Supabase выполнен
        supabase/site-media.sql.
      </p>
    )
  }

  const m = media ?? EMPTY_MEDIA
  return (
    <div className="max-w-2xl space-y-4">
      <HeroCard saved={m.heroPhoto} onSaved={(heroPhoto) => setMedia((p) => ({ ...(p ?? EMPTY_MEDIA), heroPhoto }))} />
      <GalleryCard saved={m.gallery} onSaved={(gallery) => setMedia((p) => ({ ...(p ?? EMPTY_MEDIA), gallery }))} />
    </div>
  )
}
