import { useCallback, useEffect, useMemo, useState } from 'react'
import { Car, Loader2, Phone, RotateCcw, Search, Timer, Trash2, TriangleAlert, User } from 'lucide-react'

import { supabase } from '../../supabaseClient'
import { TABLES } from '../../lib/tables'
import { ALL_BUSINESS_IDS, BOXES, EXTRAS, boxBusinessId, resolveIcon } from '../../lib/catalog'
import { BUFFER_MIN, bizDateKey, bizTime, dayParts, longDate } from '../../lib/availability'
import { cn } from '../../lib/cn'
import { formatDuration, formatPrice, telHref } from '../../lib/format'

/** Статусы в БД (detailing_bookings.status) и их названия в CRM */
export type LeadStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export const LEAD_STATUSES: { value: LeadStatus; label: string; cls: string }[] = [
  { value: 'pending', label: 'Новая', cls: 'border-amber-500/40 bg-amber-500/15 text-amber-300' },
  { value: 'confirmed', label: 'В работе', cls: 'border-sky-500/40 bg-sky-500/15 text-sky-300' },
  { value: 'completed', label: 'Завершена', cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' },
  { value: 'cancelled', label: 'Отменена', cls: 'border-red-500/40 bg-red-500/15 text-red-300' },
]
const statusMeta = (s: string) => LEAD_STATUSES.find((x) => x.value === s) ?? LEAD_STATUSES[0]

type OrderLine = { id: string; name: string; qty: number; price: number; sum: number }

type Lead = {
  id: string
  business_id: string
  box_id?: string | null
  client_name: string
  client_phone: string
  start_time: string
  end_time: string
  blocked_until?: string | null
  total_price: number
  status: LeadStatus
  created_at: string
  details?: {
    service?: string
    box?: string
    boxId?: string
    room?: string
    vehicle?: string
    vehicleClass?: string
    note?: string
    extras?: string[]
    items?: OrderLine[]
    discountPercent?: number
    discountSum?: number
    /** Сколько минут суммарно добавлено к услуге на месте (допы, задержка) */
    extendedMin?: number
  } | null
}

type Filter = 'active' | LeadStatus | 'all'

const MIN = 60_000
const MAX_EXTENSION_MIN = 480 // страховка от случайных нажатий: не больше 8 часов сверху
const EXTEND_STEPS = [
  { min: 15, label: '+15 мин' },
  { min: 30, label: '+30 мин' },
  { min: 60, label: '+1 час' },
]
const isLive = (l: Lead) => l.status === 'pending' || l.status === 'confirmed'
const extendedOf = (l: Lead) => Math.max(0, l.details?.extendedMin ?? 0)
/** Буфер уборки этой брони: blocked_until − end_time (если нет — из настроек студии) */
const bufferOf = (l: Lead) => {
  const m = l.blocked_until ? Math.round((Date.parse(l.blocked_until) - Date.parse(l.end_time)) / MIN) : 0
  return m > 0 ? m : BUFFER_MIN
}
const until = (l: Lead) => (l.blocked_until ? Date.parse(l.blocked_until) : Date.parse(l.end_time) + BUFFER_MIN * MIN)
const leadBoxKey = (l: Lead) => String(l.box_id ?? l.details?.boxId ?? '').match(/(\d+)$/)?.[1] ?? null
const boxText = (l: Lead) =>
  l.details?.box ?? l.details?.room ?? BOXES.find((x) => boxBusinessId(x) === l.business_id && !l.box_id)?.name ?? (leadBoxKey(l) ? `Бокс ${leadBoxKey(l)}` : null)

const whenParts = (l: Lead) => {
  const s = Date.parse(l.start_time)
  const p = dayParts(bizDateKey(s))
  return {
    date: `${p.weekday}, ${longDate(s)}`,
    time: `${bizTime(s)}–${bizTime(l.end_time)}`,
    dur: formatDuration(Math.round((Date.parse(l.end_time) - s) / MIN)),
  }
}

/** Чипы доп. услуг: новые брони хранят items, старые — готовые строки */
const extraChips = (l: Lead) =>
  l.details?.items?.length
    ? l.details.items.map((it) => ({ key: it.id, text: `${it.name} × ${it.qty} = ${formatPrice(it.sum)}`, icon: resolveIcon(EXTRAS.find((x) => x.id === it.id)?.icon) }))
    : (l.details?.extras ?? []).map((text, i) => ({ key: `${text}-${i}`, text, icon: resolveIcon(EXTRAS.find((x) => x.name === text)?.icon) }))

/** Выбор статуса: нативный select — удобно и на телефоне, и на ПК, доступен с клавиатуры */
function StatusSelect({ lead, busy, onChange }: { lead: Lead; busy: boolean; onChange: (s: LeadStatus) => void }) {
  const meta = statusMeta(lead.status)
  return (
    <div className="relative inline-flex items-center">
      <select
        value={lead.status}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        aria-label={`Статус заявки ${lead.client_name}`}
        className={cn('h-9 cursor-pointer appearance-none rounded-md border py-0 pl-3 pr-8 text-sm font-semibold outline-none disabled:opacity-50', meta.cls)}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s.value} value={s.value} className="bg-zinc-900 text-zinc-100">
            {s.label}
          </option>
        ))}
      </select>
      {busy ? (
        <Loader2 className="pointer-events-none absolute right-2 h-4 w-4 animate-spin" />
      ) : (
        <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-2 h-4 w-4 opacity-70">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

/** Вкладка «Заявки»: таблица лидов со сменой статуса (на телефоне — карточки) */
export default function LeadsTab({ refreshKey }: { refreshKey: number }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [query, setQuery] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from(TABLES.bookings)
      .select('*')
      .in('business_id', ALL_BUSINESS_IDS)
      .order('created_at', { ascending: false })
    if (loadError) {
      console.error(loadError)
      setError('Не удалось загрузить заявки. Проверьте, что ваш аккаунт — владелец.')
    } else {
      setError(null)
      setLeads((data ?? []) as Lead[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load, refreshKey])

  const setStatus = async (l: Lead, status: LeadStatus) => {
    if (status === l.status) return
    if (
      status === 'cancelled' &&
      !window.confirm(`Отменить заявку ${l.client_name} на ${longDate(l.start_time)}, ${bizTime(l.start_time)}? Время снова станет доступно клиентам.`)
    )
      return
    setActionId(l.id)
    setError(null)
    const { data, error: updError } = await supabase.from(TABLES.bookings).update({ status }).eq('id', l.id).select('id')
    setActionId(null)
    if (updError?.code === '23P01') {
      setError('Нельзя вернуть заявку в работу: это время уже занято другой записью.')
      return
    }
    if (updError || !data?.length) {
      console.error(updError)
      setError('Не удалось изменить статус (нет прав, статус не разрешён базой или заявка удалена).')
      return
    }
    setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, status } : x)))
  }

  const remove = async (l: Lead) => {
    if (!window.confirm(`Удалить заявку ${l.client_name} на ${longDate(l.start_time)}, ${bizTime(l.start_time)}?`)) return
    setActionId(l.id)
    setError(null)
    const { data, error: delError } = await supabase.from(TABLES.bookings).delete().eq('id', l.id).select('id')
    setActionId(null)
    if (delError || !data?.length) {
      console.error(delError)
      setError('Не удалось удалить заявку (нет прав или она уже удалена).')
      return
    }
    setLeads((prev) => prev.filter((x) => x.id !== l.id))
  }

  /* ---------- Продление записи на месте (допы, задержка) ---------- */
  type Pending = { lead: Lead; deltaMin: number; next: Lead }
  const [warn, setWarn] = useState<Pending | null>(null)

  useEffect(() => {
    if (!warn) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setWarn(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [warn])

  /** Записывает новое время: end_time и blocked_until (= end_time + буфер брони) */
  const commitExtension = async (l: Lead, deltaMin: number) => {
    const extendedMin = extendedOf(l) + deltaMin
    const end = new Date(Date.parse(l.end_time) + deltaMin * MIN)
    const blocked = new Date(end.getTime() + bufferOf(l) * MIN)
    setActionId(l.id)
    setError(null)
    const base = { end_time: end.toISOString(), blocked_until: blocked.toISOString() }
    let { data, error: updError } = await supabase
      .from(TABLES.bookings)
      .update({ ...base, details: { ...(l.details ?? {}), extendedMin } })
      .eq('id', l.id)
      .select('id')
    // В таблице нет details (миграция не выполнена) — пишем только время
    if (updError?.code === 'PGRST204') {
      ;({ data, error: updError } = await supabase.from(TABLES.bookings).update(base).eq('id', l.id).select('id'))
    }
    setActionId(null)
    if (updError?.code === '23P01') {
      setError('База не разрешает продление: время пересекается со следующей записью в этом боксе.')
      return
    }
    if (updError || !data?.length) {
      console.error(updError)
      setError('Не удалось продлить запись (нет прав или запись удалена).')
      return
    }
    setLeads((prev) =>
      prev.map((x) =>
        x.id === l.id ? { ...x, ...base, details: { ...(x.details ?? {}), extendedMin } } : x
      )
    )
  }

  /** deltaMin > 0 — продлить, null — сбросить продление к исходному времени */
  const extend = async (l: Lead, deltaMin: number | null) => {
    const ext = extendedOf(l)
    const delta = deltaMin === null ? -ext : deltaMin
    if (delta === 0) return
    if (ext + delta > MAX_EXTENSION_MIN) {
      setError('Продление больше 8 часов не поддерживается — проверьте запись.')
      return
    }
    if (delta > 0) {
      // Свежая проверка следующей записи в ЭТОМ боксе (список мог устареть)
      const key = leadBoxKey(l)
      if (key !== null) {
        setActionId(l.id)
        const { data, error: qErr } = await supabase
          .from(TABLES.bookings)
          .select('*')
          .eq('business_id', l.business_id)
          .in('status', ['pending', 'confirmed'])
          .gt('start_time', l.start_time)
          .order('start_time', { ascending: true })
        setActionId(null)
        if (qErr) {
          console.error(qErr)
          setError('Не удалось проверить следующую запись. Попробуйте ещё раз.')
          return
        }
        const newBlocked = Date.parse(l.end_time) + (delta + bufferOf(l)) * MIN
        const next = ((data ?? []) as Lead[]).find(
          (x) => x.id !== l.id && leadBoxKey(x) === key && Date.parse(x.start_time) < newBlocked
        )
        if (next) {
          setWarn({ lead: l, deltaMin: delta, next })
          return
        }
      }
    }
    await commitExtension(l, delta)
  }

  // Пересечения среди живых заявок в ОДНОМ боксе (Новая / В работе)
  const conflicts = useMemo(() => {
    const live = leads.filter((l) => l.status === 'pending' || l.status === 'confirmed')
    const ids = new Set<string>()
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]
        const c = live[j]
        if (leadBoxKey(a) === null || leadBoxKey(a) !== leadBoxKey(c)) continue
        if (Date.parse(a.start_time) < until(c) && Date.parse(c.start_time) < until(a)) {
          ids.add(a.id)
          ids.add(c.id)
        }
      }
    return ids
  }, [leads])

  const counts: Record<Filter, number> = {
    active: leads.filter((l) => l.status === 'pending' || l.status === 'confirmed').length,
    pending: leads.filter((l) => l.status === 'pending').length,
    confirmed: leads.filter((l) => l.status === 'confirmed').length,
    completed: leads.filter((l) => l.status === 'completed').length,
    cancelled: leads.filter((l) => l.status === 'cancelled').length,
    all: leads.length,
  }
  const filters: { id: Filter; label: string }[] = [
    { id: 'active', label: 'Активные' },
    { id: 'pending', label: 'Новые' },
    { id: 'confirmed', label: 'В работе' },
    { id: 'completed', label: 'Завершены' },
    { id: 'cancelled', label: 'Отменены' },
    { id: 'all', label: 'Все' },
  ]

  const q = query.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  const rows = leads.filter((l) => {
    if (q) {
      const hit = l.client_name.toLowerCase().includes(q) || (qDigits.length > 0 && l.client_phone.replace(/\D/g, '').includes(qDigits))
      if (!hit) return false
    }
    if (filter === 'all') return true
    if (filter === 'active') return l.status === 'pending' || l.status === 'confirmed'
    return l.status === filter
  })

  /** Блок продления: быстрые кнопки и сброс. Показывается только для «Новая» и «В работе» */
  const extendControls = (l: Lead) => {
    const ext = extendedOf(l)
    const busyNow = actionId === l.id
    return (
      <div className="mt-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          <Timer className="h-3.5 w-3.5" /> Продлить запись
          {ext > 0 && (
            <span className="ml-auto text-brand-fg">
              +{ext} мин · освободится в {bizTime(l.blocked_until ?? until(l))}
            </span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXTEND_STEPS.map((st) => (
            <button
              key={st.min}
              type="button"
              disabled={busyNow || ext + st.min > MAX_EXTENSION_MIN}
              onClick={() => void extend(l, st.min)}
              className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-zinc-100 transition active:scale-95 disabled:opacity-40"
            >
              {st.label}
            </button>
          ))}
          {ext > 0 && (
            <button
              type="button"
              disabled={busyNow}
              onClick={() => void extend(l, null)}
              className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-800 px-3 text-sm font-medium text-zinc-400 transition active:scale-95 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Сбросить
            </button>
          )}
        </div>
      </div>
    )
  }

  const details = (l: Lead) => {
    const chips = extraChips(l)
    return (
      <>
        <p className="text-sm font-medium text-zinc-50">{[boxText(l), l.details?.service].filter(Boolean).join(' · ') || '—'}</p>
        {l.details?.vehicle && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
            <Car className="h-3.5 w-3.5 shrink-0" />
            {l.details.vehicle}
            {l.details.vehicleClass ? ` · ${l.details.vehicleClass}` : ''}
          </p>
        )}
        {l.details?.note && <p className="mt-1.5 rounded-md bg-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-300">{l.details.note}</p>}
        {chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map(({ key, text, icon: Icon }) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-fg">
                <Icon className="h-3 w-3" /> {text}
              </span>
            ))}
          </div>
        )}
        {isLive(l) && extendControls(l)}
      </>
    )
  }

  const priceCell = (l: Lead) => (
    <>
      <span className="font-semibold tabular-nums text-zinc-50">{formatPrice(l.total_price)}</span>
      {l.details?.discountPercent ? <span className="block text-[11px] text-brand-fg">скидка −{l.details.discountPercent}%</span> : null}
    </>
  )

  const created = (l: Lead) => `${longDate(l.created_at)}, ${bizTime(l.created_at)}`

  return (
    <div>
      {warn && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center" onClick={() => setWarn(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="extend-warn-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-zinc-900 p-5 shadow-2xl"
          >
            <p id="extend-warn-title" className="flex items-start gap-2 text-base font-semibold text-amber-300">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              Внимание: в боксе есть следующая запись в {bizTime(warn.next.start_time)}
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              {warn.next.client_name}, {longDate(warn.next.start_time)}. Если продлить «{warn.lead.client_name}» на {warn.deltaMin} мин, бокс освободится в{' '}
              {bizTime(Date.parse(warn.lead.end_time) + (warn.deltaMin + bufferOf(warn.lead)) * MIN)} (с уборкой) — это позже начала следующей записи.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setWarn(null)}
                className="h-11 flex-1 rounded-lg border border-zinc-700 text-sm font-semibold text-zinc-100 transition active:scale-95"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  const w = warn
                  setWarn(null)
                  void commitExtension(w.lead, w.deltaMin)
                }}
                className="h-11 flex-1 rounded-lg bg-amber-500 text-sm font-semibold text-amber-950 transition active:scale-95"
              >
                Всё равно продлить
              </button>
            </div>
          </div>
        </div>
      )}

      <label className="mb-3 flex max-w-md items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 focus-within:ring-2 focus-within:ring-brand">
        <Search className="h-4 w-4 text-zinc-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или телефону"
          className="w-full bg-transparent text-base outline-none placeholder:text-zinc-500"
        />
      </label>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:mx-0 md:px-0">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition active:scale-95',
              filter === f.id ? 'bg-zinc-100 text-zinc-900' : 'border border-zinc-800 bg-zinc-900 text-zinc-300'
            )}
          >
            {f.label}
            <span className={cn('rounded-md px-1.5 text-xs', filter === f.id ? 'bg-zinc-900/20' : 'bg-zinc-800 text-zinc-400')}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {loading && leads.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-fg" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">Заявок нет</p>
      ) : (
        <>
          {/* ПК: таблица */}
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">Клиент</th>
                  <th className="px-4 py-3 font-medium">Запись на</th>
                  <th className="px-4 py-3 font-medium">Услуга</th>
                  <th className="px-4 py-3 font-medium">Сумма</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map((l) => {
                  const w = whenParts(l)
                  const past = Date.parse(l.end_time) < Date.now()
                  return (
                    <tr key={l.id} className={cn('align-top', (l.status === 'cancelled' || (past && l.status === 'completed')) && 'opacity-60', conflicts.has(l.id) && 'bg-red-950/20')}>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1.5 font-semibold text-zinc-50">
                          <User className="h-3.5 w-3.5 text-brand-fg" /> {l.client_name}
                        </p>
                        <a href={telHref(l.client_phone)} className="mt-1 flex items-center gap-1.5 text-brand-fg">
                          <Phone className="h-3.5 w-3.5" /> {l.client_phone}
                        </a>
                        <p className="mt-1 text-[11px] text-zinc-500">создана {created(l)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold tabular-nums text-zinc-50">{w.time}</p>
                        <p className="text-xs capitalize text-zinc-400">{w.date}</p>
                        <p className="text-xs text-zinc-500">{w.dur}</p>
                        {conflicts.has(l.id) && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-300">
                            <TriangleAlert className="h-3.5 w-3.5" /> Пересекается
                          </p>
                        )}
                      </td>
                      <td className="max-w-sm px-4 py-3">{details(l)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{priceCell(l)}</td>
                      <td className="px-4 py-3">
                        <StatusSelect lead={l} busy={actionId === l.id} onChange={(s) => void setStatus(l, s)} />
                      </td>
                      <td className="px-2 py-3">
                        <button
                          disabled={actionId === l.id}
                          onClick={() => void remove(l)}
                          aria-label="Удалить заявку"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-red-400 transition hover:bg-red-950/50 active:scale-95 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Телефон: карточки */}
          <div className="space-y-3 md:hidden">
            {rows.map((l) => {
              const w = whenParts(l)
              return (
                <article
                  key={l.id}
                  className={cn(
                    'rounded-xl border bg-zinc-900 p-4',
                    conflicts.has(l.id) ? 'border-red-500/70' : 'border-zinc-800',
                    l.status === 'cancelled' && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold tabular-nums text-zinc-50">{w.time}</p>
                      <p className="text-xs capitalize text-zinc-400">
                        {w.date} · {w.dur}
                      </p>
                    </div>
                    <StatusSelect lead={l} busy={actionId === l.id} onChange={(s) => void setStatus(l, s)} />
                  </div>
                  {conflicts.has(l.id) && (
                    <p className="mt-2 flex items-center gap-1.5 rounded-md bg-red-950/50 px-2.5 py-1.5 text-xs font-semibold text-red-300">
                      <TriangleAlert className="h-3.5 w-3.5" /> Пересекается с другой записью
                    </p>
                  )}
                  <div className="mt-3 rounded-lg bg-zinc-800/60 p-3">
                    <p className="flex items-center gap-2 font-semibold text-zinc-50">
                      <User className="h-4 w-4 text-brand-fg" /> {l.client_name}
                    </p>
                    <a href={telHref(l.client_phone)} className="mt-1.5 flex items-center gap-2 font-semibold text-brand-fg">
                      <Phone className="h-4 w-4" /> {l.client_phone}
                    </a>
                  </div>
                  <div className="mt-3">{details(l)}</div>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="text-lg">{priceCell(l)}</div>
                    <span className="text-xs text-zinc-500">создана {created(l)}</span>
                  </div>
                  <button
                    disabled={actionId === l.id}
                    onClick={() => void remove(l)}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-950/50 text-sm font-semibold text-red-400 transition active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> Удалить
                  </button>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
