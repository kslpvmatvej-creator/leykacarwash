import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'

import IncludedList from '../../components/IncludedList'
import { splitIncluded } from '../../lib/catalog'
import { cn } from '../../lib/cn'
import {
  CAR_CLASSES, MAX_DESC, MAX_DURATION, MAX_PRICE, MAX_TITLE, MIN_DURATION, isValidDuration, isValidPrice,
  type BoxType, type CarClass, type ServiceCatalog, type ServicesConfig,
} from '../../lib/slots'
import { SETTINGS_HINT, useAdminSettings } from './useAdminSettings'

const CLASS_LABEL: Record<CarClass, string> = { sedan: 'Седан', crossover: 'Кроссовер', suv: 'Внедорожник' }
const BOX_TYPE_NAME: Record<BoxType, string> = { washing: 'Мойка', detailing: 'Детейлинг' }

type Cell = { price: string; dur: string }
/** Строка формы: одна услуга. custom — создана владельцем (её можно удалить, стандартную — только скрыть) */
type Row = {
  id: string
  title: string
  description: string
  custom: boolean
  hidden: boolean
  boxType: BoxType
  category: string
  cells: Record<CarClass, Cell>
}
type Draft = Row[]

const toDraft = (catalog: ServiceCatalog): Draft =>
  Object.keys(catalog).map((id) => {
    const s = catalog[id]
    const cells = {} as Record<CarClass, Cell>
    for (const c of CAR_CLASSES) cells[c] = { price: String(s.price[c]), dur: String(s.durationMin[c]) }
    return { id, title: s.title, description: s.description ?? '', custom: !!s.custom, hidden: !!s.hidden, boxType: s.boxType, category: s.category ?? '', cells }
  })

const newRow = (boxType: BoxType): Row => {
  const cells = {} as Record<CarClass, Cell>
  for (const c of CAR_CLASSES) cells[c] = { price: '', dur: boxType === 'washing' ? '60' : '180' }
  return {
    id: `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    title: '', description: '', custom: true, hidden: false, boxType, category: '', cells,
  }
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
const priceOk = (c: Cell) => isValidPrice(num(c.price))
const durOk = (c: Cell) => isValidDuration(num(c.dur))
const rowOk = (r: Row) => r.title.trim() !== '' && r.title.trim().length <= MAX_TITLE && CAR_CLASSES.every((c) => priceOk(r.cells[c]) && durOk(r.cells[c]))

/** Форма → JSON для vladislav_settings.services_config */
const toConfig = (rows: Draft): ServicesConfig => {
  const cfg: ServicesConfig = {}
  for (const r of rows) {
    cfg[r.id] = {
      title: r.title.trim(),
      ...(r.description.trim() ? { description: r.description.trim() } : {}),
      ...(r.hidden ? { hidden: true } : {}),
      ...(r.custom ? { custom: true, boxType: r.boxType, ...(r.category.trim() ? { category: r.category.trim() } : {}) } : {}),
      sedan: { price: num(r.cells.sedan.price), durationMin: num(r.cells.sedan.dur) },
      crossover: { price: num(r.cells.crossover.price), durationMin: num(r.cells.crossover.dur) },
      suv: { price: num(r.cells.suv.price), durationMin: num(r.cells.suv.dur) },
    }
  }
  return cfg
}

const INPUT =
  'h-10 w-full rounded-lg border bg-zinc-950 px-3 text-base tabular-nums text-zinc-50 outline-none focus:border-brand'

function NumberField({
  label, value, unit, invalid, changed, onChange,
}: {
  label: string
  value: string
  unit: string
  invalid: boolean
  changed: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-label={label}
          className={cn(INPUT, 'pr-9', invalid ? 'border-red-500/70' : changed ? 'border-brand/60' : 'border-zinc-800')}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{unit}</span>
      </div>
    </label>
  )
}

/** Вкладка «Услуги и цены»: добавление своих услуг, цена и длительность по классам авто, скрытие/удаление (vladislav_settings.services_config) */
export default function PriceTab() {
  const { settings, loading, loadError, update } = useAdminSettings()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Подтягиваем форму из БД при загрузке и после сохранения/сброса
  const catalogKey = settings ? JSON.stringify(settings.allServices) : ''
  useEffect(() => {
    if (settings) setDraft(toDraft(settings.allServices))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogKey])

  const baseline = useMemo(() => (settings ? JSON.stringify(toDraft(settings.allServices)) : ''), [settings])

  if (loading || (settings && !draft)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-fg" />
      </div>
    )
  }
  if (!settings || !draft) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {loadError ? SETTINGS_HINT : 'Настройки недоступны.'}
      </p>
    )
  }

  const touch = () => {
    setSaved(false)
    setError(null)
  }
  const patchRow = (id: string, patch: Partial<Row>) => {
    setDraft((d) => (d ? d.map((r) => (r.id === id ? { ...r, ...patch } : r)) : d))
    touch()
  }
  const setCell = (id: string, c: CarClass, patch: Partial<Cell>) => {
    setDraft((d) => (d ? d.map((r) => (r.id === id ? { ...r, cells: { ...r.cells, [c]: { ...r.cells[c], ...patch } } } : r)) : d))
    touch()
  }
  const addRow = (boxType: BoxType) => {
    setDraft((d) => (d ? [...d, newRow(boxType)] : d))
    touch()
  }
  const removeRow = (r: Row) => {
    if (!window.confirm(`Удалить услугу «${r.title || 'без названия'}»? Уже созданные записи останутся.`)) return
    setDraft((d) => (d ? d.filter((x) => x.id !== r.id) : d))
    touch()
  }

  const valid = draft.every(rowOk)
  const dirty = JSON.stringify(draft) !== baseline
  const visibleCount = draft.filter((r) => !r.hidden).length
  const categories = [...new Set(draft.map((r) => r.category.trim()).filter(Boolean))]

  const save = async () => {
    if (!valid) return
    if (visibleCount === 0) {
      setError('Должна остаться хотя бы одна видимая услуга.')
      return
    }
    setSaving(true)
    setError(null)
    const err = await update({ servicesConfig: toConfig(draft) })
    setSaving(false)
    if (err) setError(err)
    else setSaved(true)
  }

  const reset = async () => {
    if (!window.confirm('Вернуть стандартные услуги, цены и время? Свои услуги будут удалены.')) return
    setSaving(true)
    setError(null)
    const err = await update({ servicesConfig: null })
    setSaving(false)
    if (err) setError(err)
    else setSaved(true)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold text-zinc-50">Услуги и цены</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Добавляйте свои услуги, меняйте названия, цену и длительность для каждого класса авто. Ненужную услугу можно
          скрыть (вернуть потом) или удалить. «Тип бокса» решает, в какие боксы записывается услуга. Изменения сразу
          применяются на сайте; уже созданные записи не меняются. Время — от {MIN_DURATION} до {MAX_DURATION} мин, цена —
          до {MAX_PRICE.toLocaleString('ru-RU')} ₽.
        </p>
      </section>

      <datalist id="service-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="hidden grid-cols-[13rem_repeat(3,minmax(0,1fr))] gap-4 border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-500 md:grid">
          <span>Услуга</span>
          {CAR_CLASSES.map((c) => (
            <span key={c}>{CLASS_LABEL[c]}</span>
          ))}
        </div>

        <ul className="divide-y divide-zinc-800">
          {draft.map((r) => (
            <li
              key={r.id}
              className={cn('grid gap-3 px-4 py-4 md:grid-cols-[13rem_repeat(3,minmax(0,1fr))] md:items-start md:gap-4', r.hidden && 'opacity-60')}
            >
              <div className="min-w-0 space-y-2">
                <input
                  value={r.title}
                  maxLength={MAX_TITLE}
                  onChange={(e) => patchRow(r.id, { title: e.target.value })}
                  placeholder="Название услуги"
                  aria-label="Название услуги"
                  aria-invalid={r.title.trim() === ''}
                  className={cn(INPUT, 'text-sm font-medium', r.title.trim() === '' ? 'border-red-500/70' : 'border-zinc-800')}
                />
                <textarea
                  value={r.description}
                  maxLength={MAX_DESC}
                  rows={6}
                  onChange={(e) => patchRow(r.id, { description: e.target.value })}
                  placeholder={'Что входит — каждая строка отдельный пункт:\nДвухфазная мойка кузова\nМойка и химчистка ковров\nПротирка проёмов и дисков'}
                  aria-label="Что входит в услугу"
                  className={cn(INPUT, 'resize-y text-xs font-normal leading-snug border-zinc-800')}
                />
                <p className="text-[11px] leading-snug text-zinc-500">
                  Каждая строка — отдельный пункт с галочкой (до 12). На сайте виден список «Что входит».
                </p>
                {splitIncluded(r.description).length > 0 && (
                  <div className="rounded-xl border border-white/5 bg-zinc-950 p-3">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-600">Так увидит клиент</p>
                    <IncludedList items={splitIncluded(r.description)} />
                  </div>
                )}
                <p className="text-[11px] text-zinc-500">
                  {BOX_TYPE_NAME[r.boxType]}
                  {r.custom ? ' · своя' : ' · стандартная'}
                  {r.hidden ? ' · скрыта' : ''}
                </p>
                {r.custom && (
                  <div className="space-y-2">
                    <select
                      value={r.boxType}
                      onChange={(e) => patchRow(r.id, { boxType: e.target.value as BoxType })}
                      aria-label="Тип бокса"
                      className={cn(INPUT, 'border-zinc-800 text-sm')}
                    >
                      <option value="washing">Тип бокса: мойка</option>
                      <option value="detailing">Тип бокса: детейлинг</option>
                    </select>
                    <input
                      value={r.category}
                      list="service-categories"
                      maxLength={40}
                      onChange={(e) => patchRow(r.id, { category: e.target.value })}
                      placeholder="Категория (необязательно)"
                      aria-label="Категория"
                      className={cn(INPUT, 'border-zinc-800 text-sm')}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => patchRow(r.id, { hidden: !r.hidden })}
                    className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 text-xs text-zinc-300 transition active:scale-95"
                  >
                    {r.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {r.hidden ? 'Показать' : 'Скрыть'}
                  </button>
                  {r.custom && (
                    <button
                      type="button"
                      onClick={() => removeRow(r)}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-red-500/30 px-2.5 text-xs text-red-300 transition active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                    </button>
                  )}
                </div>
              </div>

              {CAR_CLASSES.map((c) => {
                const cell = r.cells[c]
                return (
                  <div key={c}>
                    <p className="mb-1.5 text-xs font-medium text-zinc-400 md:hidden">{CLASS_LABEL[c]}</p>
                    <div className="flex gap-2">
                      <NumberField label="Цена" unit="₽" value={cell.price} invalid={!priceOk(cell)} changed={false} onChange={(v) => setCell(r.id, c, { price: v })} />
                      <NumberField label="Время" unit="мин" value={cell.dur} invalid={!durOk(cell)} changed={false} onChange={(v) => setCell(r.id, c, { dur: v })} />
                    </div>
                  </div>
                )
              })}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={() => addRow('washing')}
            className="flex h-10 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-medium text-zinc-100 transition active:scale-95"
          >
            <Plus className="h-4 w-4" /> Добавить услугу (мойка)
          </button>
          <button
            type="button"
            onClick={() => addRow('detailing')}
            className="flex h-10 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-medium text-zinc-100 transition active:scale-95"
          >
            <Plus className="h-4 w-4" /> Добавить услугу (детейлинг)
          </button>
        </div>
      </section>

      {!valid && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Исправьте поля с красной рамкой: название обязательно, цена — целое число,
          время — целое от {MIN_DURATION} до {MAX_DURATION} мин.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {saved && !error && <p className="text-sm text-emerald-300">Сохранено. Новый прайс уже на сайте (у клиентов обновится в течение минуты).</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || !dirty || saving}
          className="flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-brand-contrast transition active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сохранить изменения'}
        </button>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={settings.servicesConfig === null || saving}
          className="flex h-11 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 transition active:scale-95 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" /> Сбросить к стандартным
        </button>
      </div>
    </div>
  )
}
