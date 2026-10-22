/**
 * Vercel Serverless Function: уведомление владельцу о новой брони в Telegram и/или ВКонтакте.
 *
 * Запросы к api.telegram.org и api.vk.com идут С СЕРВЕРА Vercel, поэтому клиенту
 * (браузеру в РФ) никакие прокси/VPN не нужны: он обращается только к вашему домену.
 *
 * Сама заявка к этому моменту уже сохранена в Supabase (админка) — клиент вызывает
 * эту функцию ПОСЛЕ insert и не ждёт ответа, так что задержки здесь заявку не тормозят.
 *
 * Каналы независимы: если ключи канала есть — в него отправляем, если нет — пропускаем.
 * Ошибка/таймаут одного канала не влияет на другой (только пишется в лог).
 *
 * Переменные окружения (Vercel → Project → Settings → Environment Variables):
 *   Telegram:
 *     TG_BOT_TOKEN   — токен бота от @BotFather (TG_TOKEN тоже работает)
 *     TG_CHAT_ID     — ID чата владельца (число; для группы — отрицательное)
 *   ВКонтакте:
 *     VK_GROUP_TOKEN — ключ доступа сообщества (право «Сообщения сообщества»)
 *     VK_ADMIN_ID    — числовой ID администратора в ВК (user_id получателя).
 *                      Админ должен заранее разрешить сообщения от сообщества
 *                      (написать в группу / нажать «Разрешить сообщения»), иначе VK вернёт ошибку 901.
 */

// Минимальные типы, чтобы не тянуть @vercel/node
type Req = { method?: string; body?: unknown }
type Res = {
  status: (code: number) => Res
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
}

type Payload = {
  box: string
  service: string
  /** «3 дня» / «3 часа» — подставляется в скобки после названия услуги */
  duration?: string
  /** Приём авто: «12 октября» */
  date: string
  /** «10:00» */
  time: string
  /** Выдача для многодневных работ: «14 октября» / «18:00» */
  readyDate?: string
  readyTime?: string
  vehicle: string
  vehicleClass?: string
  name: string
  phone: string
  total?: number
  extras?: string[]
  note?: string
}

/** Таймаут на один исходящий запрос (на каждый канал отдельно) */
const SEND_TIMEOUT_MS = 10_000

/** Версия VK API */
const VK_API_VERSION = '5.199'

/** Лимит VK на длину одного сообщения — 4096 символов */
const VK_MAX_MESSAGE = 4000

/** Экранирование для parse_mode=HTML */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : null

function parse(raw: unknown): Payload | null {
  let body = raw
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return null
    }
  }
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const box = str(b.box, 60)
  const service = str(b.service, 120)
  const vehicle = str(b.vehicle, 80)
  const name = str(b.name, 100)
  const phone = str(b.phone, 30)
  const date = str(b.date, 60)
  const time = str(b.time, 40)
  if (!box || !service || !vehicle || !name || !phone || !date || !time) return null

  const total = Number(b.total)

  return {
    box,
    service,
    duration: str(b.duration, 40) ?? undefined,
    date,
    time,
    readyDate: str(b.readyDate, 60) ?? undefined,
    readyTime: str(b.readyTime, 40) ?? undefined,
    vehicle,
    vehicleClass: str(b.vehicleClass, 60) ?? undefined,
    name,
    phone,
    total: Number.isFinite(total) && total >= 0 ? total : undefined,
    note: str(b.note, 300) ?? undefined,
    extras: Array.isArray(b.extras)
      ? b.extras
          .map((e) => str(e, 100))
          .filter((e): e is string => !!e)
          .slice(0, 20)
      : [],
  }
}

/** Как оформлять текст в конкретном канале */
type Fmt = {
  bold: (s: string) => string
  esc: (s: string) => string
}

/** Единый шаблон заявки: состав строк один, различается только разметка */
function buildLines(p: Payload, f: Fmt): string {
  // «Детейлинг-мойка» не содержит срока — добавляем его в скобках, если он не продублирован в названии
  const showDuration = p.duration && !p.service.toLowerCase().includes(p.duration.toLowerCase())
  const service = showDuration ? `${p.service} (${p.duration})` : p.service

  const lines = [
    f.bold('🛠 Новая запись в студию!'),
    `Бокс: ${f.esc(p.box)}`,
    `Услуга: ${f.esc(service)}`,
    `Приём авто: ${f.esc(p.date)}, ${f.esc(p.time)}`,
  ]
  // Многодневные работы: когда клиент заберёт машину
  if (p.readyDate && p.readyTime) lines.push(`Выдача: ${f.esc(p.readyDate)}, ${f.esc(p.readyTime)}`)
  lines.push(`Авто: ${f.esc(p.vehicle)}${p.vehicleClass ? ` (${f.esc(p.vehicleClass)})` : ''}`)
  lines.push(`Клиент: ${f.esc(p.name)}, ${f.esc(p.phone)}`)
  // Допы показываем, только если клиент их выбрал
  if (p.extras?.length) lines.push(`Допы: ${p.extras.map(f.esc).join('; ')}`)
  if (p.note) lines.push(`Комментарий: ${f.esc(p.note)}`)
  if (p.total !== undefined) lines.push(`Ориентировочно: ${p.total.toLocaleString('ru-RU')} ₽`)
  return lines.join('\n')
}

/** Telegram: parse_mode=HTML */
const buildMessage = (p: Payload): string =>
  buildLines(p, { bold: (s) => `<b>${s}</b>`, esc })

/** ВКонтакте: обычный текст, без HTML-разметки (поэтому и без экранирования) */
const buildVkMessage = (p: Payload): string =>
  buildLines(p, { bold: (s) => s, esc: (s) => s }).slice(0, VK_MAX_MESSAGE)

/** POST с таймаутом; тело читаем внутри таймаута, чтобы «зависший» ответ тоже не держал функцию */
async function postWithTimeout(
  url: string,
  init: { headers: Record<string, string>; body: string },
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const r = await fetch(url, { method: 'POST', ...init, signal: controller.signal })
    const text = await r.text().catch(() => '')
    return { ok: r.ok, status: r.status, text }
  } finally {
    clearTimeout(timer)
  }
}

/** Отправка в Telegram. Никогда не бросает исключение: возвращает true/false. */
async function sendTelegram(token: string, chatId: string, p: Payload): Promise<boolean> {
  try {
    const r = await postWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(p),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!r.ok) {
      // Тело ответа Telegram в логи, но не клиенту (в нём может быть служебная информация)
      console.error('telegram: sendMessage failed', r.status, r.text)
      return false
    }
    return true
  } catch (e) {
    console.error('telegram: request failed', e)
    return false
  }
}

/**
 * Отправка в личку ВКонтакте (messages.send). Никогда не бросает исключение.
 * VK отвечает HTTP 200 даже при ошибке — признак ошибки это поле `error` в JSON.
 */
async function sendVk(token: string, adminId: string, p: Payload): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      user_id: adminId,
      // Обязателен и должен быть уникальным: по нему VK отсекает дубли. Влезает в int32.
      random_id: String(Math.floor(Math.random() * 1e9)),
      message: buildVkMessage(p),
      access_token: token, // в теле запроса, а не в URL — чтобы токен не попал в логи
      v: VK_API_VERSION,
    })
    const r = await postWithTimeout('https://api.vk.com/method/messages.send', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!r.ok) {
      console.error('vk: messages.send http error', r.status, r.text)
      return false
    }
    let data: { error?: { error_code?: number; error_msg?: string } } | null = null
    try {
      data = JSON.parse(r.text)
    } catch {
      // не JSON — разберём ниже
    }
    if (!data || data.error) {
      // Логируем только код и текст ошибки: полный объект error у VK содержит request_params
      console.error('vk: messages.send failed', data?.error?.error_code, data?.error?.error_msg ?? r.text)
      return false
    }
    return true
  } catch (e) {
    console.error('vk: request failed', e)
    return false
  }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store')

  // CORS: нужен, когда сайт открыт с другого домена (например, GitHub Pages).
  // Чтобы разрешить только свой домен, задайте ALLOWED_ORIGIN (например https://user.github.io)
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).json({})

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const tgToken = process.env.TG_BOT_TOKEN ?? process.env.TG_TOKEN
  const tgChatId = process.env.TG_CHAT_ID
  const vkToken = process.env.VK_GROUP_TOKEN
  const vkAdminId = process.env.VK_ADMIN_ID?.trim()

  const tgReady = !!tgToken && !!tgChatId
  const vkReady = !!vkToken && !!vkAdminId

  // Половина пары заданных ключей — почти наверняка опечатка в настройках, пишем в лог
  if (!tgReady && (tgToken || tgChatId)) console.error('telegram: нужны оба ключа — TG_BOT_TOKEN и TG_CHAT_ID')
  if (!vkReady && (vkToken || vkAdminId)) console.error('vk: нужны оба ключа — VK_GROUP_TOKEN и VK_ADMIN_ID')

  if (!tgReady && !vkReady) {
    console.error('notify: не настроен ни один канал (TG_BOT_TOKEN+TG_CHAT_ID или VK_GROUP_TOKEN+VK_ADMIN_ID)')
    return res.status(500).json({ ok: false, error: 'Server is not configured' })
  }

  const payload = parse(req.body)
  if (!payload) return res.status(400).json({ ok: false, error: 'Bad request' })

  // Каналы запускаются параллельно и независимо друг от друга.
  // Ждём оба до ответа, иначе Vercel может «заморозить» функцию вместе с ещё не отправленным запросом.
  const channels: Array<{ name: 'telegram' | 'vk'; job: Promise<boolean> }> = []
  if (tgReady) channels.push({ name: 'telegram', job: sendTelegram(tgToken!, tgChatId!, payload) })
  if (vkReady) channels.push({ name: 'vk', job: sendVk(vkToken!, vkAdminId!, payload) })

  const settled = await Promise.allSettled(channels.map((c) => c.job))
  const sent = channels.filter((_, i) => {
    const r = settled[i]
    return r.status === 'fulfilled' && r.value
  })

  // Успех, если дошло хотя бы в один канал
  if (sent.length > 0) return res.status(200).json({ ok: true, sent: sent.map((c) => c.name) })
  return res.status(502).json({ ok: false, error: 'Notification delivery failed' })
}
