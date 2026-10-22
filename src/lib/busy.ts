import { addDays, startOfDay } from 'date-fns'

import { supabase } from '../supabaseClient'
import { TABLES } from './tables'
import { DAYS_AHEAD } from './availability'
import type { BusyInterval } from './slots'

/** Строка, которую возвращает RPC get_detailing_busy_slots */
type BusyRow = { box_id: string | null; start_time: string; blocked_until: string }

/**
 * box_id в БД: '1' / '2' / '3' (новые брони) или 'box-1' (старый формат) — берём число в конце.
 * Строки без привязки к боксу отбрасываем: «чужая» занятость ломает расписание.
 */
const boxNumber = (raw: string | null): number | null => {
  const m = raw?.match(/(\d+)$/)
  return m ? Number(m[1]) : null
}

function toBusy(rows: BusyRow[] | null): BusyInterval[] {
  const out: BusyInterval[] = []
  for (const r of rows ?? []) {
    const box_id = boxNumber(r.box_id)
    if (box_id !== null) out.push({ box_id, start_at: r.start_time, busy_until: r.blocked_until })
  }
  return out
}

async function rpc(businessId: string, from: Date, to: Date): Promise<BusyInterval[] | null> {
  const { data, error } = await supabase.rpc(TABLES.busyRpc, {
    p_business_id: businessId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
  if (error) {
    console.error(error)
    return null
  }
  return toBusy(data as BusyRow[] | null)
}

/** Занятость всех боксов на всё окно записи одним запросом (null — запрос не удался) */
export function fetchBusy(businessId: string): Promise<BusyInterval[] | null> {
  const today = startOfDay(new Date())
  return rpc(businessId, addDays(today, -2), addDays(today, DAYS_AHEAD + 2))
}

/** Свежая занятость вокруг конкретного времени — для финальной проверки перед записью */
export function fetchBusyAround(businessId: string, from: Date, to: Date): Promise<BusyInterval[] | null> {
  return rpc(businessId, new Date(from.getTime() - 24 * 3600_000), new Date(to.getTime() + 24 * 3600_000))
}
