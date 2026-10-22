import { useCallback, useEffect, useState } from 'react'

import BookingSheet from '../components/BookingSheet'
import BookingWidget from '../components/BookingWidget'
import BoxTile from '../components/BoxTile'
import FloatingContact from '../components/FloatingContact'
import Gallery from '../components/Gallery'
import Hero from '../components/Hero'
import PillNav from '../components/PillNav'
import Preloader from '../components/Preloader'
import ServiceTable from '../components/ServiceTable'
import StatsRow from '../components/StatsRow'
import business from '../business.json'
import { ALL_BUSINESS_IDS, BOXES, boxNumber, boxPriceFrom, type Box } from '../lib/catalog'
import { boxStatus, isOpenAt, type BoxStatus } from '../lib/availability'
import { fetchBusy } from '../lib/busy'
import { loadGuestSettings, resolveGuestSettings, type GuestSettingsMap } from '../lib/guestSettings'
import { activeDiscount, useShopSettings } from '../lib/settings'
import { useSiteMedia } from '../lib/siteMedia'
import type { BusyInterval, ServiceId } from '../lib/slots'

type SheetState = { open: boolean; key: number; serviceId?: ServiceId }

const SETTINGS_CACHE_KEY = 'detailing:box-settings:v1'
const readSettingsCache = (): GuestSettingsMap | null => {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    return raw ? (JSON.parse(raw) as GuestSettingsMap) : null
  } catch {
    return null
  }
}

export default function ClientView() {
  const [sheet, setSheet] = useState<SheetState>({ open: false, key: 0 })

  // Настройки боксов (в т.ч. фото из админки) кэшируются: при обновлении страницы картинки известны сразу
  const [overrides, setOverrides] = useState<GuestSettingsMap>(() => readSettingsCache() ?? {})
  const [settingsReady, setSettingsReady] = useState(() => readSettingsCache() !== null)
  const [now, setNow] = useState(() => new Date())
  // null — занятость ещё грузится
  const [busy, setBusy] = useState<BusyInterval[] | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  /* ---- Настройки владельца (vladislav_settings): включённые боксы и глобальная скидка ---- */
  const { settings, loaded: shopLoaded, reload: reloadSettings } = useShopSettings()
  const discountPercent = activeDiscount(settings)

  /* ---- Фото сайта из админки: баннер и галерея работ ---- */
  const { media, loaded: mediaLoaded } = useSiteMedia()

  /* ---- Настройки боксов из админки (подготовка, акция, фото) ---- */
  useEffect(() => {
    let cancelled = false
    Promise.all(ALL_BUSINESS_IDS.map((id) => loadGuestSettings(id))).then((maps) => {
      if (cancelled) return
      const merged: GuestSettingsMap = {}
      for (const m of maps) if (m) Object.assign(merged, m)
      setOverrides(merged)
      setSettingsReady(true)
      if (maps.some(Boolean)) {
        try {
          localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged))
        } catch {
          /* хранилище недоступно — не критично */
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  /* ---- Занятость боксов: одна загрузка на всё окно записи, общая для плиток и формы ---- */
  const reloadBusy = useCallback(async () => {
    const list = await fetchBusy(business.businessId)
    if (list) setBusy(list) // при ошибке оставляем прежние данные
  }, [])

  useEffect(() => {
    void reloadBusy()
    const timer = window.setInterval(() => {
      setNow(new Date())
      void reloadBusy()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [reloadBusy, reloadKey])

  /* ---- Прелоадер: пока не пришли настройки и занятость из Supabase (но не дольше 6 с — сеть может быть плохой) ---- */
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 6000)
    return () => window.clearTimeout(t)
  }, [])
  const appLoading = !timedOut && !(shopLoaded && settingsReady && mediaLoaded && busy !== null)

  /* ---- Статус боксов (логика — boxStatus в lib/availability.ts); выключенный владельцем бокс — «не принимает» ---- */
  const openNow = isOpenAt(now)
  const activeOf = (b: Box) => settings.boxActive[boxNumber(b) as 1 | 2 | 3] !== false
  const statusOf = (b: Box): BoxStatus | null => {
    if (!activeOf(b)) return boxStatus(now, [], false)
    if (openNow && !busy) return null // занятость ещё не загрузилась
    return boxStatus(now, (busy ?? []).filter((x) => x.box_id === boxNumber(b)), true)
  }
  const statusKnown = openNow && busy !== null
  const freeCount = BOXES.filter((b) => statusOf(b)?.kind === 'free').length
  const totalBoxes = BOXES.filter(activeOf).length

  /* ---- Открытие шторки ---- */
  const openBooking = (preset?: { serviceId?: ServiceId }) =>
    setSheet((s) =>
      preset
        ? { open: true, key: s.key + 1, serviceId: preset.serviceId } // строка прайса → форма с нуля
        : { ...s, open: true } // общая кнопка → продолжаем с того места, где остановился клиент
    )
  const closeSheet = (done: boolean) => {
    if (done) {
      setSheet((s) => ({ open: false, key: s.key + 1 }))
      setReloadKey((k) => k + 1)
    } else {
      setSheet((s) => ({ ...s, open: false }))
    }
  }

  /* ---------- Разметка ---------- */
  return (
    <div className="min-h-dvh bg-black">
      <Preloader loading={appLoading} />
      {/*
        Bento-сетка: на десктопе 12 колонок, на телефоне одна.
        Hero и статистика — на всю ширину; ниже услуги (8) и липкий виджет записи (4).
      */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-32 pt-4 lg:pb-10">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div id="home" className="lg:col-span-12">
            <Hero freeBoxes={statusKnown ? freeCount : null} totalBoxes={totalBoxes} photo={media.heroPhoto} onBook={() => openBooking()} />
          </div>

          <div className="lg:col-span-12">
            <StatsRow services={settings.services} />
          </div>

          <main className="flex min-w-0 flex-col gap-8 lg:col-span-8">
            <ServiceTable discountPercent={discountPercent} services={settings.services} onBook={(serviceId) => openBooking({ serviceId })} />

            <Gallery photos={media.gallery} />

            <section id="boxes" className="scroll-mt-4" aria-labelledby="boxes-title">
              <div className="mb-3 flex items-baseline gap-3 px-1">
                <h2 id="boxes-title" className="text-xl font-semibold tracking-tight text-white">
                  Боксы
                </h2>
                <p className="text-xs text-zinc-500">У каждого своя специализация и свой календарь</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {BOXES.map((b, i) => (
                  <BoxTile
                    key={b.id}
                    box={b}
                    settings={resolveGuestSettings(b, overrides)}
                    status={statusOf(b)}
                    discountPercent={discountPercent}
                    priceFrom={boxPriceFrom(b, settings.services)}
                    ready={settingsReady}
                    priority={i === 0}
                    onBook={() => openBooking()}
                  />
                ))}
              </div>
            </section>
          </main>

          {/* Правая колонка: контейнер тянется на всю высоту, виджет внутри залипает */}
          <aside className="lg:col-span-4">
            <BookingWidget freeBoxes={statusKnown ? freeCount : null} totalBoxes={totalBoxes} onBook={() => openBooking()} />
          </aside>

          <footer className="pt-4 text-center lg:col-span-12">
            <a href="#admin" className="text-xs text-zinc-600 underline-offset-4 hover:underline">
              Вход для владельца
            </a>
          </footer>
        </div>
      </div>

      {/* Плавающие элементы: таблетка навигации (только телефон) и кнопка связи */}
      <PillNav bookingOpen={sheet.open} onBooking={() => openBooking()} />
      <FloatingContact hidden={sheet.open} />

      <BookingSheet
        key={sheet.key}
        open={sheet.open}
        onClose={closeSheet}
        initialServiceId={sheet.serviceId}
        settings={settings}
        busy={busy}
        reloadBusy={reloadBusy}
        reloadSettings={reloadSettings}
      />
    </div>
  )
}
