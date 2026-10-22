import business from '../business.json'

/**
 * Имена таблиц и RPC этого клиента (business.json → "tables").
 * У Владислава — исторические имена; у новых клиентов скрипт new-client.mjs задаёт <slug>_bookings, <slug>_settings.
 */
type Names = { bookings: string; settings: string; busyRpc: string }
const t = (business as { tables?: Partial<Names> }).tables

export const TABLES: Names = {
  bookings: t?.bookings ?? 'detailing_bookings',
  settings: t?.settings ?? 'vladislav_settings',
  busyRpc: t?.busyRpc ?? 'get_detailing_busy_slots',
}
