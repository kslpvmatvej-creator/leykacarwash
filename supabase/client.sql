-- ============================================================
-- НОВЫЙ КЛИЕНТ: две СВОИ таблицы ({{BOOKINGS}}, {{SETTINGS}}) + функция занятости {{RPC}}.
-- Общие для всех клиентов: businesses (владельцы), service_settings (фото боксов), хранилище «photos» —
-- они создаются «если нет», у остальных клиентов не затрагиваются.
-- Плейсхолдеры {{...}} подставляет scripts/new-client.mjs. Повторный запуск безопасен.
-- Перед запуском в Authentication → Users должен существовать пользователь {{OWNER_EMAIL}}
-- (скрипт создаёт его сам при --service-key; иначе: Add user → Create new user, Auto Confirm User).
-- ============================================================

create extension if not exists btree_gist;

-- ---------- 1. Бизнес (владелец) ----------
create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users (id) on delete set null,
  name        text not null,
  phone       text,
  description text,
  created_at  timestamptz not null default now()
);
alter table public.businesses enable row level security;
drop policy if exists businesses_owner_select on public.businesses;
create policy businesses_owner_select on public.businesses for select to authenticated using (owner_id = auth.uid());
grant select on public.businesses to authenticated;

-- ---------- 2. Заявки ----------
create table if not exists public.{{BOOKINGS}} (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  box_id        text,
  client_name   text not null,
  client_phone  text not null,
  car_class     text,
  car_model     text,
  service_id    text,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  blocked_until timestamptz,
  total_price   numeric not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists {{BOOKINGS}}_business_start_idx on public.{{BOOKINGS}} (business_id, start_time);

alter table public.{{BOOKINGS}} enable row level security;
drop policy if exists {{BOOKINGS}}_public_insert on public.{{BOOKINGS}};
drop policy if exists {{BOOKINGS}}_owner_select  on public.{{BOOKINGS}};
drop policy if exists {{BOOKINGS}}_owner_update  on public.{{BOOKINGS}};
drop policy if exists {{BOOKINGS}}_owner_delete  on public.{{BOOKINGS}};

-- Клиенты сайта (anon) могут только создать новую заявку; читать чужие — нет
create policy {{BOOKINGS}}_public_insert on public.{{BOOKINGS}}
  for insert to anon, authenticated with check (status = 'pending');

create policy {{BOOKINGS}}_owner_select on public.{{BOOKINGS}}
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy {{BOOKINGS}}_owner_update on public.{{BOOKINGS}}
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy {{BOOKINGS}}_owner_delete on public.{{BOOKINGS}}
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

grant insert on public.{{BOOKINGS}} to anon, authenticated;
grant select, update, delete on public.{{BOOKINGS}} to authenticated;

-- Один бокс — не больше одной брони в одно время (с учётом подготовки бокса)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = '{{BOOKINGS}}_box_no_overlap') then
    alter table public.{{BOOKINGS}}
      add constraint {{BOOKINGS}}_box_no_overlap
      exclude using gist (
        business_id with =,
        box_id      with =,
        tstzrange(start_time, coalesce(blocked_until, end_time), '[)') with &&
      )
      where (status <> 'cancelled');
  end if;
end $$;

-- ---------- 3. Занятость боксов для сайта (anon не читает заявки напрямую) ----------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '{{RPC}}'
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create function public.{{RPC}}(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns table (box_id text, start_time timestamptz, blocked_until timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(b.box_id::text, b.details->>'boxId'), b.start_time, coalesce(b.blocked_until, b.end_time)
  from public.{{BOOKINGS}} b
  where b.business_id = p_business_id
    and b.status <> 'cancelled'
    and b.start_time < p_to
    and coalesce(b.blocked_until, b.end_time) > p_from
  order by b.start_time;
$$;
revoke all on function public.{{RPC}}(uuid, timestamptz, timestamptz) from public;
grant execute on function public.{{RPC}}(uuid, timestamptz, timestamptz) to anon, authenticated;

-- ---------- 4. Настройки владельца: боксы, скидка, услуги и цены ----------
create table if not exists public.{{SETTINGS}} (
  business_id      uuid primary key references public.businesses (id) on delete cascade,
  box_1_active     boolean  not null default true,
  box_2_active     boolean  not null default true,
  box_3_active     boolean  not null default true,
  discount_enabled boolean  not null default false,
  discount_percent smallint not null default 0 check (discount_percent between 0 and 90),
  services_config  jsonb check (services_config is null or jsonb_typeof(services_config) = 'object'),
  updated_at       timestamptz not null default now()
);

create or replace function public.{{SETTINGS}}_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists {{SETTINGS}}_touch on public.{{SETTINGS}};
create trigger {{SETTINGS}}_touch before update on public.{{SETTINGS}}
  for each row execute function public.{{SETTINGS}}_touch();

alter table public.{{SETTINGS}} enable row level security;
drop policy if exists {{SETTINGS}}_read   on public.{{SETTINGS}};
drop policy if exists {{SETTINGS}}_insert on public.{{SETTINGS}};
drop policy if exists {{SETTINGS}}_update on public.{{SETTINGS}};
create policy {{SETTINGS}}_read on public.{{SETTINGS}} for select to anon, authenticated using (true);
create policy {{SETTINGS}}_insert on public.{{SETTINGS}} for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy {{SETTINGS}}_update on public.{{SETTINGS}} for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
grant select on public.{{SETTINGS}} to anon, authenticated;
grant insert, update on public.{{SETTINGS}} to authenticated;

-- Нельзя создать бронь в боксе, который владелец выключил (защита от «устаревших» вкладок клиентов)
create or replace function public.{{BOOKINGS}}_check_box_active() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; active boolean;
begin
  n := nullif(regexp_replace(coalesce(new.box_id::text, ''), '\D', '', 'g'), '')::int;
  if n is null or n not between 1 and 3 then return new; end if;
  select case n when 1 then box_1_active when 2 then box_2_active else box_3_active end
    into active from public.{{SETTINGS}} where business_id = new.business_id;
  if active is false then raise exception 'BOX_DISABLED' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists {{BOOKINGS}}_check_box_active on public.{{BOOKINGS}};
create trigger {{BOOKINGS}}_check_box_active before insert on public.{{BOOKINGS}}
  for each row execute function public.{{BOOKINGS}}_check_box_active();

-- ---------- 5. Фото боксов ----------
create table if not exists public.service_settings (
  business_id         uuid not null references public.businesses (id) on delete cascade,
  service_id          text not null,
  base_guests         int  not null default 8,
  max_guests          int  not null default 10,
  extra_guest_price   numeric not null default 0,
  cleaning_buffer_min int,
  promo_enabled       boolean not null default false,
  promo_text          text,
  promo_percent       int not null default 0,
  photo_url_1         text,
  photo_url_2         text,
  photo_url_3         text,
  photo_url_4         text,
  updated_at          timestamptz not null default now(),
  primary key (business_id, service_id)
);
alter table public.service_settings enable row level security;
drop policy if exists service_settings_read  on public.service_settings;
drop policy if exists service_settings_write on public.service_settings;
create policy service_settings_read on public.service_settings for select to anon, authenticated using (true);
create policy service_settings_write on public.service_settings for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
grant select on public.service_settings to anon, authenticated;
grant insert, update, delete on public.service_settings to authenticated;

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

-- ---------- Привязка владельца ----------
do $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower('{{OWNER_EMAIL}}') limit 1;
  if uid is null then
    raise exception 'Пользователь {{OWNER_EMAIL}} не найден: создайте его в Authentication → Users (Auto Confirm User) и запустите скрипт снова';
  end if;

  insert into public.businesses (id, owner_id, name, phone, description)
  values ('{{BUSINESS_ID}}', uid, '{{NAME}}', '{{PHONE}}', '{{DESCRIPTION}}')
  on conflict (id) do update
    set owner_id = excluded.owner_id, name = excluded.name, phone = excluded.phone, description = excluded.description;

  insert into public.{{SETTINGS}} (business_id) values ('{{BUSINESS_ID}}') on conflict (business_id) do nothing;
end $$;


-- Проверка:
--   select id, owner_id, name from public.businesses;
--   select * from public.{{SETTINGS}};

notify pgrst, 'reload schema';
