import { useEffect, useState } from 'react'
import { Loader2, Percent, TriangleAlert } from 'lucide-react'

import Switch from '../../components/Switch'
import { formatPrice } from '../../lib/format'
import { MAX_DISCOUNT, clampPercent, discounted } from '../../lib/settings'
import { SETTINGS_HINT, useAdminSettings } from './useAdminSettings'

const PRESETS = [5, 10, 15, 20, 25]

/** Вкладка «Маркетинг»: глобальная скидка (vladislav_settings.discount_enabled / discount_percent) */
export default function MarketingTab() {
  const { settings, loading, loadError, update } = useAdminSettings()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Поле ввода синхронизируем с БД при первой загрузке
  useEffect(() => {
    if (settings) setDraft(settings.discountPercent ? String(settings.discountPercent) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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

  const typed = draft.trim() === '' ? 0 : Number(draft)
  const typedOk = Number.isInteger(typed) && typed >= 1 && typed <= MAX_DISCOUNT
  const dirty = typed !== settings.discountPercent

  const run = async (patch: Parameters<typeof update>[0]) => {
    setSaving(true)
    setError(null)
    setSaved(false)
    const err = await update(patch)
    setSaving(false)
    if (err) setError(err)
    else setSaved(true)
  }

  const toggle = (next: boolean) => {
    if (next && !typedOk) {
      setError(`Укажите скидку — целое число от 1 до ${MAX_DISCOUNT} %`)
      return
    }
    // Включая, сохраняем и процент одним запросом
    void run(next ? { discountEnabled: true, discountPercent: typed } : { discountEnabled: false })
  }

  const apply = () => {
    if (!typedOk) {
      setError(`Скидка — целое число от 1 до ${MAX_DISCOUNT} %`)
      return
    }
    void run({ discountPercent: typed })
  }

  const sample = settings.services.complex_wash
  const samplePrice = sample.price.sedan
  const previewPercent = typedOk ? clampPercent(typed) : 0

  return (
    <div className="max-w-2xl space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-zinc-50">Глобальная скидка</h2>
            <p className="mt-1 text-sm text-zinc-400">
              На сайте старые цены зачёркиваются, рядом показываются новые. Скидка действует на всю запись, включая
              дополнительные услуги.
            </p>
          </div>
          <Switch checked={settings.discountEnabled} disabled={saving} label="Глобальная скидка" onChange={toggle} />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block w-36">
            <span className="mb-1 block text-xs text-zinc-400">Размер скидки, %</span>
            <div className="relative">
              <Percent aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_DISCOUNT}
                step={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setSaved(false)
                }}
                placeholder="10"
                aria-label="Размер скидки в процентах"
                className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 pr-9 text-base tabular-nums text-zinc-50 outline-none focus:border-brand"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={apply}
            disabled={saving || !dirty}
            className="flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-contrast transition active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сохранить'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setDraft(String(p))
                setSaved(false)
              }}
              className={`h-9 rounded-md border px-3 text-sm font-medium transition active:scale-95 ${
                typed === p ? 'border-zinc-100 bg-zinc-100 text-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-300'
              }`}
            >
              −{p}%
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {saved && !error && (
          <p className="mt-3 text-sm text-emerald-300">
            {settings.discountEnabled
              ? `Скидка −${settings.discountPercent}% действует на сайте.`
              : 'Сохранено. Скидка выключена — включите тумблер, чтобы она появилась на сайте.'}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs text-zinc-500">Так это будет выглядеть на сайте</p>
        <p className="mt-2 text-sm text-zinc-300">{sample.title}, седан</p>
        <p className="mt-1 flex items-baseline gap-3 tabular-nums">
          {previewPercent > 0 && <span className="text-zinc-500 line-through">{formatPrice(samplePrice)}</span>}
          <span className={`text-2xl font-semibold ${previewPercent > 0 ? 'text-brand-fg' : 'text-zinc-50'}`}>
            {formatPrice(discounted(samplePrice, previewPercent))}
          </span>
        </p>
      </section>
    </div>
  )
}
