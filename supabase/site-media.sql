-- Фото сайта, которые владелец загружает в админке (вкладка «Фото сайта»).
-- Выполнить один раз в Supabase → SQL Editor. Для другого клиента замените имя таблицы
-- на значение business.json → tables.settings.
alter table public.vladislav_settings
  add column if not exists hero_photo_url   text,
  add column if not exists gallery_photo_1  text,
  add column if not exists gallery_photo_2  text,
  add column if not exists gallery_photo_3  text;

-- Обновить кэш схемы PostgREST, чтобы новые колонки стали видны API сразу
notify pgrst, 'reload schema';
