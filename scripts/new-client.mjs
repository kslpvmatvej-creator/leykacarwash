#!/usr/bin/env node
/**
 * Подготовка нового клиента одной командой. Все клиенты живут в ОДНОМ Supabase-проекте, но у каждого
 * свои две таблицы: <slug>_bookings и <slug>_settings (+ функция <slug>_busy_slots). Общие: businesses, service_settings, хранилище photos.
 *
 *   node scripts/new-client.mjs --name "Detail Pro" --email owner@mail.ru --address "г. Омск, ул. Ленина, 5" \
 *        --phone "+7 900 000-00-00" --tg detailpro --wa 79000000000 --open 09:00 --close 21:00 --tz 360 \
 *        [--service-key eyJ...] [--pat sbp_...] [--apply]
 *
 * URL и anon key берутся из текущего .env (общий проект); можно переопределить --supabase-url / --anon-key.
 *
 * Что делает:
 *   1. генерирует businessId и пароль владельца;
 *   2. собирает clients/<slug>/business.json (из шаблона src/business.json);
 *   3. собирает clients/<slug>/setup.sql из supabase/client.sql: две таблицы клиента, права, функции, строка в businesses (owner_id по email) + строка настроек;
 *   4. пишет clients/<slug>/.env и CHECKLIST.md;
 *   5. с --service-key создаёт пользователя-владельца в Supabase Auth;
 *   6. с --pat выполняет setup.sql через Management API;
 *   7. с --apply кладёт business.json и .env в проект (src/business.json, .env).
 *
 * Без --service-key и --pat остаются два ручных шага: создать пользователя и вставить setup.sql в SQL Editor.
 * Сетевые шаги (5–6) пробуйте осторожно: при ошибке скрипт напишет, что сделать руками.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ---------- аргументы ---------- */
const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue
  const key = argv[i].slice(2)
  const next = argv[i + 1]
  if (next === undefined || next.startsWith('--')) args[key] = true
  else {
    args[key] = next
    i++
  }
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = async (key, question, fallback) => {
  if (typeof args[key] === 'string') return args[key].trim()
  if (!process.stdin.isTTY) return fallback ?? ''
  const a = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim()
  return a || fallback || ''
}

/* ---------- общий Supabase-проект: значения по умолчанию из .env ---------- */
const envFile = join(ROOT, '.env')
const envDefaults = {}
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m) envDefaults[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

/* ---------- утилиты ---------- */
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
const slugify = (s) =>
  s.toLowerCase().split('').map((ch) => TR[ch] ?? ch).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'client'
const sql = (s) => String(s).replace(/'/g, "''")
const hhmm = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

/* ---------- ввод ---------- */
const name = await ask('name', 'Название студии')
const email = await ask('email', 'E-mail владельца (логин в админку)')
if (!name || !email.includes('@')) {
  console.error('Нужны --name и корректный --email')
  process.exit(1)
}
const shortName = await ask('short', 'Короткое название (в шапке)', name.split(/\s+/)[0].toUpperCase().slice(0, 12))
const address = await ask('address', 'Адрес', 'Адрес не указан')
const phone = await ask('phone', 'Телефон', '')
const tg = (await ask('tg', 'Telegram-ник без @', '')).replace(/^@/, '')
const wa = (await ask('wa', 'WhatsApp (цифры, 79001234567)', '')).replace(/\D/g, '')
const open = await ask('open', 'Открытие ЧЧ:ММ', '09:00')
const close = await ask('close', 'Закрытие ЧЧ:ММ', '21:00')
const tz = Number(await ask('tz', 'Часовой пояс, минуты от UTC (МСК=180, Новосибирск=420)', '180'))
const color = await ask('color', 'Акцентный цвет', '#3b82f6')
const supabaseUrl = (await ask('supabase-url', 'Supabase Project URL', envDefaults.VITE_SUPABASE_URL ?? '')).replace(/\/+$/, '')
const anonKey = await ask('anon-key', 'Supabase anon key', envDefaults.VITE_SUPABASE_ANON_KEY ?? '')
const slug = args.slug || slugify(name)
rl.close()

if (!hhmm(open) || !hhmm(close) || open >= close) {
  console.error('Часы работы: формат ЧЧ:ММ, открытие раньше закрытия')
  process.exit(1)
}
if (!Number.isFinite(tz) || Math.abs(tz) > 14 * 60) {
  console.error('--tz: минуты от UTC, например 180 для Москвы')
  process.exit(1)
}

const snake = (/^[a-z]/.test(slug) ? slug : `c_${slug}`).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30)
const tables = { bookings: `${snake}_bookings`, settings: `${snake}_settings`, busyRpc: `get_${snake}_busy_slots` }
const businessId = randomUUID()
const password = randomBytes(9).toString('base64url') // 12 символов
const outDir = join(ROOT, 'clients', slug)
mkdirSync(outDir, { recursive: true })

/* ---------- business.json ---------- */
const cfg = JSON.parse(readFileSync(join(ROOT, 'src/business.json'), 'utf8'))
cfg.businessId = businessId
cfg.name = name
cfg.shortName = shortName
cfg.address = address
cfg.phone = phone
cfg.contacts = { telegram: tg, whatsapp: wa }
cfg.workingHours = { open, close }
cfg.utcOffsetMinutes = tz
cfg.themeColor = color
cfg.tables = tables
cfg.boxes = cfg.boxes.map((b) => ({ ...b, businessId }))
// Фото и подписи «Работ студии» в шаблоне принадлежат прежней студии — заменяем нейтральными заглушками
cfg.gallery = [
  { photo: cfg.boxes[0].photos[0], caption: 'Общий вид' },
  { photo: cfg.boxes[1].photos[1], caption: 'Детали кузова' },
  { photo: cfg.boxes[2].photos[0], caption: 'Элементы салона' },
]
writeFileSync(join(outDir, 'business.json'), JSON.stringify(cfg, null, 2) + '\n')

/* ---------- setup.sql ---------- */
const description = `Онлайн-запись в студию «${name}»`
const setupSql = readFileSync(join(ROOT, 'supabase/client.sql'), 'utf8')
  .replaceAll('{{BOOKINGS}}', tables.bookings)
  .replaceAll('{{SETTINGS}}', tables.settings)
  .replaceAll('{{RPC}}', tables.busyRpc)
  .replaceAll('{{BUSINESS_ID}}', businessId)
  .replaceAll('{{OWNER_EMAIL}}', sql(email))
  .replaceAll('{{NAME}}', sql(name))
  .replaceAll('{{PHONE}}', sql(phone))
  .replaceAll('{{DESCRIPTION}}', sql(description))
writeFileSync(join(outDir, 'setup.sql'), setupSql)

/* ---------- .env ---------- */
const env = `VITE_SUPABASE_URL=${supabaseUrl}\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`
writeFileSync(join(outDir, '.env'), env)

/* ---------- сеть: пользователь и SQL ---------- */
const notes = []
const hostRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : ''

if (typeof args['service-key'] === 'string' && supabaseUrl) {
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: args['service-key'], Authorization: `Bearer ${args['service-key']}` },
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
    if (r.ok) notes.push('✔ Пользователь-владелец создан в Supabase Auth.')
    else notes.push(`✖ Пользователя создать не удалось (${r.status}: ${(await r.text()).slice(0, 200)}). Создайте вручную: Authentication → Users → Add user (Auto Confirm).`)
  } catch (e) {
    notes.push(`✖ Нет связи с Supabase Auth (${e.message}). Создайте пользователя вручную.`)
  }
} else {
  notes.push(`☐ Создайте пользователя вручную: Supabase → Authentication → Users → Add user → ${email} / пароль из credentials.txt, галочка Auto Confirm User.`)
}

if (typeof args.pat === 'string' && hostRef) {
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${hostRef}/database/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.pat}` },
      body: JSON.stringify({ query: setupSql }),
    })
    if (r.ok) notes.push('✔ setup.sql выполнен в базе клиента.')
    else notes.push(`✖ setup.sql не выполнился (${r.status}: ${(await r.text()).slice(0, 300)}). Вставьте clients/${slug}/setup.sql в SQL Editor вручную.`)
  } catch (e) {
    notes.push(`✖ Нет связи с Supabase Management API (${e.message}). Вставьте setup.sql в SQL Editor вручную.`)
  }
} else {
  notes.push(`☐ Supabase → SQL Editor → выполните clients/${slug}/setup.sql (после создания пользователя): создаст таблицы ${tables.bookings} и ${tables.settings}, добавит клиента в businesses.`)
}

/* ---------- --apply ---------- */
if (args.apply) {
  writeFileSync(join(ROOT, 'src/business.json'), JSON.stringify(cfg, null, 2) + '\n')
  writeFileSync(join(ROOT, '.env'), env)
  notes.push('✔ src/business.json и .env обновлены под клиента (--apply). Дальше: npm run build и деплой.')
} else {
  notes.push(`☐ Подставьте конфиг: скопируйте clients/${slug}/business.json → src/business.json и clients/${slug}/.env → .env (или запустите с --apply).`)
}

writeFileSync(join(outDir, 'credentials.txt'), `Админка: <адрес сайта>/#admin\nЛогин: ${email}\nПароль: ${password}\n\nПароль нужно сменить сразу после первого входа (Supabase → Authentication → Users → Send password recovery).\n`)

writeFileSync(
  join(outDir, 'CHECKLIST.md'),
  `# ${name} — чек-лист запуска

${notes.join('\n')}
☐ Vercel: создать новый проект из этого же кода с переменными \`VITE_SUPABASE_URL\`, \`VITE_SUPABASE_ANON_KEY\` (те же, общий Supabase) и \`TG_BOT_TOKEN\`, \`TG_CHAT_ID\` клиента (уведомления о заявках).
☐ Задеплоить, открыть сайт: проверить, что цены, боксы и время видны.
☐ Зайти в \`/#admin\` логином и паролем из credentials.txt, загрузить фото боксов и (при желании) поправить услуги.
☐ Тестовая запись с телефона → заявка видна в админке и пришла в Telegram → отменить тестовую.
☐ Передать клиенту ссылку, логин/пароль и короткую инструкцию.

businessId: ${businessId}
`
)

console.log(`\nКлиент «${name}» → clients/${slug}/\n`)
console.log(notes.join('\n'))
console.log(`\nЛогин: ${email}\nПароль: ${password}  (также в clients/${slug}/credentials.txt)\n`)
