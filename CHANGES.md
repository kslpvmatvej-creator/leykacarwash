# Шаг 1: пивот в премиальный автодетейлинг (Graphite Detailing)

**Данные и логика**
- `src/business.json` (бывший `config.json`) — студия, `boxes` (посты), `services` (длительность в `durationMinutes` ИЛИ в `durationDays`), `vehicleClasses` (коэффициенты цены), `extras`, `multiDay` (окно приёма авто и время выдачи), `closedWeekdays`, `prepTimeMinutes`.
- `src/lib/catalog.ts` — типы `Box`/`Service`, цена по классу авто, реестр иконок.
- `src/lib/slots.ts` — многодневные услуги: бокс блокируется непрерывным интервалом «приём → выдача», выходные (`closedWeekdays`) в срок не считаются; `buildServiceSlots`, `serviceEnd`, `isIntervalFree`, `boxStatus`.
- `src/lib/busy.ts` — одна загрузка занятости бокса на всё окно записи (с запасом на самую долгую услугу).
- Схема Supabase не менялась: интервал брони хранится в тех же `start_time`/`end_time`/`blocked_until`, детали — в `details` (jsonb).

**Интерфейс (mobile-first, desktop = виджет по центру)**
- `components/Hero.tsx`, `BoxCard.tsx`, `ServiceCard.tsx`, `CarPhoto.tsx` (графитовая заглушка вместо битых фото), `StatusBadge.tsx`.
- `components/BookingSheet.tsx` — бокс → автомобиль → услуга → дата → время → допы → контакты. На мобильном bottom sheet, с `md` — окно max-w-2xl.
- `components/Sheet.tsx` — адаптивная шторка. `index.css` — графитовые токены и утилиты `glass`, `glass-dark`, `metal-text`, `hairline`.

**Сопутствующее**
- `api/telegram.ts` — уведомление в новом формате (бокс, услуга, приём/выдача, авто).
- `AdminView.tsx`, `GuestSettingsEditor.tsx` — терминология боксов, многодневные брони, подготовка бокса вместо уборки.
- `boxes_setup.sql` вместо `rooms_setup.sql`.

---

# Шаг 2: детейлинг-ретушь интерфейса

- `src/lib/ui.ts` — единые классы кнопок (`btnPrimary`, `btnGlass`, `btnGlassSm`) и шкала радиусов: контейнеры `rounded-3xl`, элементы управления `rounded-2xl`, чипы `rounded-full`.
- `src/index.css` — утилиты `interactive` / `hover-lift` (scale 1.01 + тонкое свечение рамки только при наведении), `glass` без внутренних бликов.
- `src/components/CornerArrow.tsx` — круглая стрелка `↗` для карточек.
- `src/components/BottomBar.tsx` — стеклянная нижняя навигация (якоря + «Записать авто»): скрыта, пока в Hero видна главная кнопка, и уезжает вниз у контактов, ничего не перекрывая. Контейнер получил `pb-24`.
- `Hero.tsx` — тонкий логотип, факты одной панелью с разделителями `divide-white/10`, без тяжёлых теней.
- `ServiceCard.tsx`, `BoxCard.tsx`, `ExtraCard.tsx`, `BookingSheet.tsx`, `ClientView.tsx` — стрелки `↗`, единые радиусы, контакты одной панелью.

---

# Шаг 3: Bento-дашборд для десктопа

- `ClientView.tsx` — сетка `max-w-7xl`, `grid-cols-1 lg:grid-cols-12`: Hero (12) → статистика (12) → услуги и боксы (8) + липкий виджет записи (4). Фон `bg-black`, на телефоне всё в одну колонку.
- `Hero.tsx` — панорамный баннер `h-[400px] rounded-3xl`: фото, зерно (`grain`), затемнение снизу, зеркальная кнопка «Записаться ↗» (`mirror`).
- `StatsRow.tsx` — три плашки (услуги, боксы, цена «от»), считаются из `business.json`.
- `ServiceTable.tsx` — услуги строками-таблицей с фильтром по категории.
- `BoxTile.tsx` — компактные плитки боксов со статусом.
- `BookingWidget.tsx` — «Запись в студию», `lg:sticky lg:top-4`, синяя неоновая кнопка (`btnNeon`).
- `BottomBar.tsx` — только на мобильных (`lg:hidden`).
- `index.css` — `glass` = `bg-zinc-900/40 border-white/5`; утилиты `mirror`, `grain`, `neon`.
- `business.json` — `themeColor: #3b82f6` (оранжевого в интерфейсе больше нет). `BoxCard.tsx`, `ServiceCard.tsx` больше не используются.

---

# Шаг 4: минималистичные детали

- `PillNav.tsx` — плавающая «таблетка» (`fixed bottom-6 left-1/2`, только телефон): Главная / Услуги / Моя запись, активная иконка светится белым (по положению на странице, «Моя запись» — пока открыта шторка). Старый `BottomBar.tsx` удалён.
- `Gallery.tsx` — «Работы студии»: одно широкое фото и два квадратных, подписи `text-zinc-500 text-sm mt-2`. Данные — `gallery` в `business.json`.
- `Hero.tsx` — высота `h-[320px]`, затемнение, радиальная тень, зерно; фото заменено на силуэт из `business.json`.
- `FloatingContact.tsx` — круглая стеклянная кнопка связи справа снизу (Telegram / WhatsApp / звонок).

---

# Шаг 5: мобильная полировка

- `PillNav.tsx` — причина «сжатия»: у `fixed` + `left-1/2` доступная ширина была 50vw. Добавлены `w-max max-w-[calc(100vw-1.5rem)]`, `shrink-0` и `whitespace-nowrap` у пунктов; на узких экранах (<380px) `gap-5 px-5`.
- `StatsRow.tsx` — `min-w-0`, `truncate`, шрифт `text-base` → `text-lg` → `md:text-3xl`; «от» перенесено в подпись.
- `BookingWidget.tsx` — единый `p-5`, вертикальный ритм `gap-4`, ровные строки `py-3`, кнопки Telegram/WhatsApp в `grid grid-cols-2 gap-3` одинаковой высоты `h-12`.

## Автораспределение боксов, управление боксами, CRM и маркетинг

- `vladislav_settings.sql` — таблица настроек владельца (боксы 1–3, глобальная скидка), RLS: читают все, меняет владелец.
- `vladislav_hardening.sql` — (рекомендуется) ограничение «один бокс — одна бронь» и запрет записи в выключенный бокс на уровне БД.
- `lib/slots.ts` — генератор принимает `boxActive` из настроек: выключенный бокс исключается до формирования слотов.
- `lib/settings.ts`, `lib/availability.ts`, `lib/busy.ts` — настройки/скидка, время студии (UTC+7), занятость боксов.
- `BookingSheet` — классы авто: 1 колонка на телефоне, 3 в ряд на ПК; бокс клиенту не показывается и подбирается автоматически.
- Админка: вкладки «Заявки», «Управление боксами», «Маркетинг» (`views/admin/*`).
- Прайс и плитки боксов показывают скидку: старая цена зачёркнута, рядом новая.

## Продление записей и управление прайсом

- `vladislav_services_config.sql` — колонка `services_config jsonb` в `vladislav_settings`.
- Админка → «Заявки»: для «Новая» и «В работе» кнопки +15 мин / +30 мин / +1 час и «Сбросить»; пересчитываются `end_time` и `blocked_until` (буфер брони сохраняется), при накладке на следующую запись в боксе — предупреждение.
- Админка → «Прайс-лист» (`views/admin/PriceTab.tsx`): цена и длительность 4 услуг × 3 класса.
- `lib/slots.ts`: `resolveServices`, параметр `services` у `generateSlots` / `findBoxForStart`; форма записи и прайс на сайте берут цены из настроек, иначе из каталога.

---

# Автоматизация продажи

- `scripts/new-client.mjs` + `supabase/client.sql` — онбординг клиента одной командой в общем Supabase (строка в businesses + настройки, пользователь, конфиг, чек-лист). `supabase/migrate-existing.sql` — разовая миграция действующей базы, `supabase/new-project.sql` — для пустого Supabase.
- Заявка теперь пишет `car_class`, `car_model`, `service_id` (отдельные колонки, как в таблице).
- Услуги динамические: `lib/slots.ts` (`resolveServices`, `ServiceOverride`) — свои услуги, переименование и скрытие стандартных хранятся в `vladislav_settings.services_config`; схема БД не менялась. Вкладка «Услуги и цены» (`views/admin/PriceTab.tsx`) — полный редактор.
- Фото: `lib/upload.ts` — загрузка с устройства в Supabase Storage (бакет `photos`) со сжатием до 1400 px WebP; `components/PhotoCarousel.tsx` — свайп-галерея всех фото бокса на плитке.
- Имена таблиц клиента вынесены в `business.json → tables` (`lib/tables.ts`). Описание услуги (`description`) редактируется в «Услуги и цены» и показывается в прайсе и в форме записи.
- Описание услуги = список «Что входит»: каждая строка — пункт с галочкой (`splitIncluded`, `IncludedList`), в прайсе раскрывающийся блок, в форме записи показывается у выбранной услуги, в админке живой предпросмотр.
