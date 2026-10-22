-- ============================================================
-- vladislav_settings: настройки владельца (одна строка на бизнес).
-- Выполните в Supabase → SQL Editor. Скрипт идемпотентный.
--
--   box_1_active / box_2_active / box_3_active — бокс принимает клиентов (false = не вышел сотрудник)
--   discount_enabled / discount_percent        — глобальная скидка на сайте
--
-- Читать может любой (сайт должен знать, какие боксы включены и есть ли скидка),
-- менять — только владелец бизнеса (businesses.owner_id = auth.uid()).
-- ============================================================

create table if not exists public.vladislav_settings (
  business_id      uuid primary key references public.businesses (id) on delete cascade,
  box_1_active     boolean     not null default true,
  box_2_active     boolean     not null default true,
  box_3_active     boolean     not null default true,
  discount_enabled boolean     not null default false,
  discount_percent smallint    not null default 0 check (discount_percent between 0 and 90),
  updated_at       timestamptz not null default now()
);

-- updated_at обновляется автоматически
create or replace function public.vladislav_settings_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists vladislav_settings_touch on public.vladislav_settings;
create trigger vladislav_settings_touch
  before update on public.vladislav_settings
  for each row execute function public.vladislav_settings_touch();

-- Строка по умолчанию для основного бизнеса (businessId из src/business.json)
insert into public.vladislav_settings (business_id)
values ('2ead704b-12f6-4857-b0ce-ba8a64433292')
on conflict (business_id) do nothing;

-- RLS
alter table public.vladislav_settings enable row level security;

drop policy if exists vladislav_settings_read   on public.vladislav_settings;
drop policy if exists vladislav_settings_insert on public.vladislav_settings;
drop policy if exists vladislav_settings_update on public.vladislav_settings;

create policy vladislav_settings_read
  on public.vladislav_settings for select
  to anon, authenticated
  using (true);

create policy vladislav_settings_insert
  on public.vladislav_settings for insert
  to authenticated
  with check (exists (
    select 1 from public.businesses b
    where b.id = vladislav_settings.business_id and b.owner_id = auth.uid()
  ));

create policy vladislav_settings_update
  on public.vladislav_settings for update
  to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = vladislav_settings.business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = vladislav_settings.business_id and b.owner_id = auth.uid()
  ));

grant select on public.vladislav_settings to anon, authenticated;
grant insert, update on public.vladislav_settings to authenticated;

-- Прайс-лист владельца (JSON); null — используется каталог по умолчанию из lib/slots.ts
alter table public.vladislav_settings
  add column if not exists services_config jsonb
  check (services_config is null or jsonb_typeof(services_config) = 'object');

notify pgrst, 'reload schema';

-- Проверка:
--   select * from public.vladislav_settings;
