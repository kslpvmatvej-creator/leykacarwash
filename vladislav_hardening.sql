-- ============================================================
-- ЗАЩИТА НА УРОВНЕ БД (рекомендуется, но выполняйте осознанно).
-- Фронтенд скрывает слоты выключенных боксов и перепроверяет всё перед записью,
-- но только БД защищает от гонок и «устаревших» вкладок клиентов.
-- Не прогонялось на вашей базе — сначала выполните блок 0 (диагностика).
-- ============================================================

-- 0. Диагностика: какие ограничения уже есть на detailing_bookings
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.detailing_bookings'::regclass;
-- Если есть exclusion-ограничение (contype = 'x') БЕЗ box_id в определении,
-- оно запрещает параллельные брони разных боксов одного бизнеса — две мойки работать не смогут.
-- Тогда удалите его вручную: alter table public.detailing_bookings drop constraint <имя>;

-- 1. Статус «completed» (Завершена) должен быть разрешён
--    (выполняйте, только если в блоке 0 есть check по status без 'completed')
-- alter table public.detailing_bookings drop constraint <имя_check_по_status>;
-- alter table public.detailing_bookings add constraint detailing_bookings_status_check
--   check (status in ('pending', 'confirmed', 'completed', 'cancelled'));

-- 2. Один бокс — не больше одной брони в одно время (с учётом подготовки бокса).
--    Упадёт, если в таблице уже есть пересекающиеся брони одного box_id — сначала разберите их.
create extension if not exists btree_gist;

alter table public.detailing_bookings
  add constraint detailing_bookings_box_no_overlap
  exclude using gist (
    business_id with =,
    box_id      with =,
    tstzrange(start_time, coalesce(blocked_until, end_time), '[)') with &&
  )
  where (status <> 'cancelled');

-- 3. Нельзя создать бронь в боксе, который владелец выключил.
--    box_id принимает '1' / '2' / '3' и старый формат 'box-1'.
create or replace function public.detailing_check_box_active()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n int;
  active boolean;
begin
  n := nullif(regexp_replace(coalesce(new.box_id::text, ''), '\D', '', 'g'), '')::int;
  if n is null or n not between 1 and 3 then
    return new;
  end if;
  select case n when 1 then box_1_active when 2 then box_2_active else box_3_active end
    into active
    from public.vladislav_settings
   where business_id = new.business_id;
  if active is false then
    raise exception 'BOX_DISABLED' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists detailing_check_box_active on public.detailing_bookings;
create trigger detailing_check_box_active
  before insert on public.detailing_bookings
  for each row execute function public.detailing_check_box_active();
