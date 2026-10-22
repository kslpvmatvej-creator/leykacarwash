-- ============================================================
-- МИГРАЦИЯ ДЛЯ УЖЕ РАБОТАЮЩЕЙ БАЗЫ (Владислав и др.). Ничего не удаляет и не трогает существующие политики.
-- Выполнить один раз в Supabase → SQL Editor.
--   1) колонки car_class / car_model / service_id в detailing_bookings (если ещё нет);
--   2) service_id должен быть text (id услуг: complex_wash, custom_xxx) — приводим, если там другой тип;
--   3) хранилище фото «photos» + права (загрузка только владельцем в папку своего business_id).
-- ============================================================

alter table public.detailing_bookings add column if not exists car_class  text;
alter table public.detailing_bookings add column if not exists car_model  text;
alter table public.detailing_bookings add column if not exists service_id text;

do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'detailing_bookings' and column_name = 'service_id') <> 'text' then
    alter table public.detailing_bookings alter column service_id type text using service_id::text;
  end if;
end $$;

-- ---------- 6. Хранилище фото (загрузка из админки) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists photos_public_read  on storage.objects;
drop policy if exists photos_owner_insert on storage.objects;
drop policy if exists photos_owner_update on storage.objects;
drop policy if exists photos_owner_delete on storage.objects;
create policy photos_public_read on storage.objects for select using (bucket_id = 'photos');
-- Первая папка в пути = id бизнеса; писать туда может только его владелец
create policy photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
create policy photos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
create policy photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

notify pgrst, 'reload schema';
