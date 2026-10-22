# Graphite Detailing — онлайн-запись (PWA)

React 19 + Vite + Tailwind 4 + Supabase. Премиальный dark UI для студии детейлинга и оклейки.

```bash
npm install
npm run dev      # локально
npm run build    # tsc -b && vite build
```

Переменные окружения: `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`;
в Vercel для уведомлений — `TG_BOT_TOKEN`, `TG_CHAT_ID`.

## Настройка студии

Всё редактируется в `src/business.json`: название, контакты, акцентный цвет (`themeColor`),
часы работы, боксы, услуги, классы авто, допы. Админка — `/#admin`.

Услуга задаёт длительность одним из полей:
- `durationMinutes` — в пределах рабочего дня (мойка, химчистка);
- `durationDays` — многодневная работа (PPF, оклейка): авто принимают в окне `multiDay.dropOffFrom–dropOffTo`,
  выдают в `multiDay.handoverTime` последнего рабочего дня.

Каждому боксу нужна своя строка в `businesses` — см. `boxes_setup.sql`.

## Продажа нового клиента

Один Supabase-проект на всех. У каждого клиента **свои две таблицы** (`<slug>_bookings`, `<slug>_settings`) и своя функция
занятости; их имена записаны в `src/business.json → tables`. У Владислава — исторические `detailing_bookings` / `vladislav_settings`.
Общие для всех: `businesses` (владельцы), `service_settings` (фото боксов), хранилище `photos`.

**Владислав (разово):** выполнить `supabase/migrate-existing.sql`, затем выложить проект.

**Новый клиент:**

```bash
node scripts/new-client.mjs --name "Detail Pro" --email owner@mail.ru \
  --address "г. Омск, ул. Ленина, 5" --phone "+7 900 000-00-00" --tg detailpro --wa 79000000000 \
  --open 09:00 --close 21:00 --tz 360 [--service-key eyJ...] [--pat sbp_...] --apply
```

URL и anon key берутся из `.env`. Скрипт создаёт `clients/<slug>/`: `business.json` (businessId, имена таблиц, контакты, часы),
`setup.sql` (таблицы клиента, права, функции, строка в `businesses`), `.env`, `CHECKLIST.md`, `credentials.txt`.
Дальше — см. чек-лист: пользователь в Auth, `setup.sql` в SQL Editor, новый проект в Vercel (`TG_BOT_TOKEN`, `TG_CHAT_ID`).

Клиент сам управляет в `/#admin`: услуги (добавить, переименовать, описание, скрыть, удалить, цена и время по классам авто),
фото боксов (загрузка с телефона), скидка, боксы, заявки.
