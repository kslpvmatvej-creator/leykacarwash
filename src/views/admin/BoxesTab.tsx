import { useEffect, useState } from 'react'
import { ChevronDown, Loader2, TriangleAlert, Wrench } from 'lucide-react'

import GuestSettingsEditor from '../../components/GuestSettingsEditor'
import Switch from '../../components/Switch'
import { ALL_BUSINESS_IDS, BOXES, boxBusinessId } from '../../lib/catalog'
import { loadGuestSettings, resolveGuestSettings, type GuestSettingsMap } from '../../lib/guestSettings'
import { BOX_DEFS, BOX_TYPE_LABEL, boxLabel, countActiveBoxes, type BoxType } from '../../lib/slots'
import { toBoxActive } from '../../lib/settings'
import { SETTINGS_HINT, useAdminSettings } from './useAdminSettings'

/** Вкладка «Управление боксами»: тумблеры активности (vladislav_settings) + фото боксов */
export default function BoxesTab() {
  const { settings, loading, loadError, update } = useAdminSettings()
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [photosOpen, setPhotosOpen] = useState(false)
  const [guestOverrides, setGuestOverrides] = useState<GuestSettingsMap>({})
  useEffect(() => {
    Promise.all(ALL_BUSINESS_IDS.map((id) => loadGuestSettings(id))).then((maps) => {
      const merged: GuestSettingsMap = {}
      for (const m of maps) if (m) Object.assign(merged, m)
      setGuestOverrides(merged)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-fg" />
      </div>
    )
  }
  if (!settings) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {loadError ? SETTINGS_HINT : 'Настройки недоступны.'}
      </p>
    )
  }

  const boxActive = toBoxActive(settings)

  const toggle = async (id: 1 | 2 | 3, next: boolean) => {
    setSavingId(id)
    setError(null)
    const err = await update({ boxActive: { [id]: next } })
    setSavingId(null)
    if (err) setError(err)
  }

  const warnings = (['washing', 'detailing'] as BoxType[])
    .filter((t) => countActiveBoxes(t, boxActive) === 0)
    .map((t) => `Все боксы типа «${BOX_TYPE_LABEL[t]}» выключены — запись на эти услуги на сайте закрыта.`)

  return (
    <div className="max-w-2xl space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold text-zinc-50">Управление боксами</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Выключите бокс, если сотрудник не вышел: на сайте исчезнут слоты этого бокса. Если выключить один из двух
          моечных боксов, мойка продолжит работать на оставшемся. Уже созданные записи не отменяются.
        </p>

        <ul className="mt-4 divide-y divide-zinc-800">
          {BOX_DEFS.map((b) => {
            const id = b.id as 1 | 2 | 3
            const on = settings.boxActive[id]
            return (
              <li key={b.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-50">{boxLabel(b)}</p>
                  <p className={`mt-0.5 text-xs ${on ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {on ? 'Принимает клиентов' : 'Выключен — слоты не показываются'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {savingId === id && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
                  <Switch
                    checked={on}
                    disabled={savingId !== null}
                    label={boxLabel(b)}
                    onChange={(next) => void toggle(id, next)}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        {warnings.map((w) => (
          <p key={w} className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {w}
          </p>
        ))}
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <button
          type="button"
          onClick={() => setPhotosOpen((v) => !v)}
          aria-expanded={photosOpen}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-fg">
            <Wrench className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-tight text-zinc-50">Фото боксов</span>
            <span className="block text-xs text-zinc-400">Картинки на карточках боксов на сайте</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 ${photosOpen ? 'rotate-180' : ''}`} />
        </button>
        {photosOpen && (
          <div className="mt-4">
            <GuestSettingsEditor
              services={BOXES.map((x) => ({ id: x.id, name: x.name, businessId: boxBusinessId(x) }))}
              getSettings={(id) => resolveGuestSettings(BOXES.find((x) => x.id === id) ?? { id, name: id }, guestOverrides)}
              onSaved={(id, s) => setGuestOverrides((prev) => ({ ...prev, [id]: s }))}
            />
          </div>
        )}
      </section>
    </div>
  )
}
