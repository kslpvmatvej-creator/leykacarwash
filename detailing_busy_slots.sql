-- ============================================================
-- get_detailing_busy_slots: занятые интервалы боксов с привязкой к боксу.
-- Выполните в Supabase → SQL Editor.
--
-- Возвращает 3 колонки: box_id, start_time, blocked_until.
-- blocked_until = конец работ + подготовка бокса; если у старой брони его нет — берём end_time.
-- Отменённые брони (status = 'cancelled') не блокируют бокс.
-- Берутся брони, пересекающиеся с окном [p_from, p_to).
-- SECURITY DEFINER: у anon нет права читать detailing_bookings, а занятость видеть нужно.
-- ============================================================

-- Тип результата меняется, поэтому старую функцию (любую сигнатуру) удаляем целиком.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_detailing_busy_slots'
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create function public.get_detailing_busy_slots(
  p_business_id uuid,
  p_from        timestamptz,
  p_to          timestamptz
)
returns table (
  box_id        text,
  start_time    timestamptz,
  blocked_until timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    -- у броней, созданных до появления box_id, бокс лежит в details->>'boxId'
    coalesce(b.box_id::text, b.details->>'boxId') as box_id,
    b.start_time,
    coalesce(b.blocked_until, b.end_time)         as blocked_until
  from public.detailing_bookings b
  where b.business_id = p_business_id
    and b.status <> 'cancelled'
    and b.start_time < p_to
    and coalesce(b.blocked_until, b.end_time) > p_from
  order by b.start_time;
$$;

revoke all on function public.get_detailing_busy_slots(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_detailing_busy_slots(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Обновить кеш схемы PostgREST
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Проверка (подставьте свой business_id и даты):
--   select * from public.get_detailing_busy_slots(
--     '2ead704b-12f6-4857-b0ce-ba8a64433292', now() - interval '3 days', now() + interval '30 days');
--
-- ВАЖНО: если у брони box_id = null и в details нет boxId, фронтенд такую бронь
-- не привяжет ни к одному боксу. Посмотреть такие строки:
--   select id, start_time from public.detailing_bookings
--   where box_id is null and details->>'boxId' is null;
-- ------------------------------------------------------------
