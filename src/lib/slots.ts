// lib/slots.ts
// Генератор слотов для автомойки на 3 бокса.
// Чистые функции без обращений к БД: данные (занятость, флаги боксов из vladislav_settings) передаются снаружи.
//
// Боксы описаны в BOX_DEFS (1 и 2 — мойка, 3 — детейлинг). Включён бокс или выключен владельцем,
// решает vladislav_settings: флаги приходят параметром `boxActive` и ПЕРЕКРЫВАЮТ Box.is_active.
// Выключенный бокс не участвует в генерации вообще: вместимость мойки падает с 2 до 1.

// ---------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------
export type BoxType = "washing" | "detailing";
export type CarClass = "sedan" | "crossover" | "suv";
/** id услуги: стандартные (complex_wash …) или созданные владельцем в админке (custom_xxx) */
export type ServiceId = string;

export interface Box {
  id: number;
  type: BoxType;
  is_active: boolean;
  sort_order?: number;
}

/** Флаги активности боксов из vladislav_settings: { 1: true, 2: false, 3: true }. Нет ключа — не меняем Box.is_active */
export type BoxActiveMap = Partial<Record<number, boolean>>;

/** Существующая заявка (только неотменённые). busy_until уже включает буфер. */
export interface BusyInterval {
  box_id: number;
  start_at: string; // ISO
  busy_until: string; // ISO
}

export interface Service {
  title: string;
  boxType: BoxType;
  durationMin: Record<CarClass, number>;
  price: Record<CarClass, number>;
  /** Описание услуги, что входит (задаёт владелец в админке) */
  description?: string;
  /** Категория для фильтра прайса (у стандартных услуг берётся из catalog.ts) */
  category?: string;
  icon?: string;
  /** Услуга создана владельцем в админке */
  custom?: boolean;
  /** Скрыта владельцем: на сайте и в записи не показывается */
  hidden?: boolean;
}

export interface Slot {
  /** Начало услуги, ISO (UTC) */
  start: string;
  /** Конец самой услуги (без буфера), ISO */
  end: string;
  /** Бокс освободится после уборки (end + буфер), ISO */
  busyUntil: string;
  /** Предложенный бокс (по умолчанию первый свободный по sort_order) */
  boxId: number;
  /** Все свободные боксы на этот слот */
  freeBoxIds: number[];
  /** Сколько параллельных записей ещё можно сделать на это время */
  capacity: number;
}

export interface SlotConfig {
  /** Открытие / закрытие, минуты от полуночи по местному времени (по умолчанию 09:00–21:00) */
  openMin: number;
  closeMin: number;
  /** Шаг сетки слотов, мин */
  stepMin: number;
  /** Буфер на уборку после каждой услуги, мин */
  bufferMin: number;
  /** Смещение местного времени от UTC в минутах (МСК = 180, Владивосток = 600) */
  utcOffsetMin: number;
  /** Минимальный запас до ближайшей записи от "сейчас", мин */
  minLeadMin: number;
  /** Если true, буфер тоже должен уместиться в рабочий день */
  bufferMustFitInWorkday: boolean;
  /** Выходные дни недели по местному времени (0 = вс … 6 = сб) */
  closedWeekdays: number[];
}

export const DEFAULT_CONFIG: SlotConfig = {
  openMin: 9 * 60,
  closeMin: 21 * 60,
  stepMin: 30,
  bufferMin: 15,
  utcOffsetMin: 180,
  minLeadMin: 60,
  bufferMustFitInWorkday: false,
  closedWeekdays: [],
};

// ---------------------------------------------------------------------
// Боксы
// ---------------------------------------------------------------------
export const BOX_DEFS: Box[] = [
  { id: 1, type: "washing", is_active: true, sort_order: 1 },
  { id: 2, type: "washing", is_active: true, sort_order: 2 },
  { id: 3, type: "detailing", is_active: true, sort_order: 3 },
];

export const BOX_TYPE_LABEL: Record<BoxType, string> = {
  washing: "Мойка",
  detailing: "Детейлинг",
};

/** «Бокс 2 (Мойка)» — подпись для админки */
export const boxLabel = (b: Box): string => `Бокс ${b.id} (${BOX_TYPE_LABEL[b.type]})`;

/** Эффективная активность бокса: флаг из настроек важнее Box.is_active */
export const isBoxActive = (b: Box, boxActive?: BoxActiveMap): boolean =>
  boxActive?.[b.id] ?? b.is_active;

/** BOX_DEFS с применёнными флагами из vladislav_settings */
export const resolveBoxes = (boxActive?: BoxActiveMap): Box[] =>
  BOX_DEFS.map((b) => ({ ...b, is_active: isBoxActive(b, boxActive) }));

/** Сколько боксов типа сейчас принимают клиентов (для предупреждений в админке) */
export const countActiveBoxes = (type: BoxType, boxActive?: BoxActiveMap): number =>
  BOX_DEFS.filter((b) => b.type === type && isBoxActive(b, boxActive)).length;

// ---------------------------------------------------------------------
// Каталог услуг (порядок в Record: sedan / crossover / suv)
// ---------------------------------------------------------------------
export const SERVICES: Record<string, Service> = {
  complex_wash: {
    title: "Комплексная мойка",
    boxType: "washing",
    price: { sedan: 1500, crossover: 1800, suv: 2200 },
    durationMin: { sedan: 60, crossover: 75, suv: 90 },
  },
  detailing_wash: {
    title: "Детейлинг мойка",
    boxType: "washing",
    price: { sedan: 5000, crossover: 6000, suv: 7000 },
    durationMin: { sedan: 120, crossover: 150, suv: 180 },
  },
  polishing: {
    title: "Полировка кузова",
    boxType: "detailing",
    price: { sedan: 15000, crossover: 17000, suv: 19000 },
    durationMin: { sedan: 300, crossover: 360, suv: 420 },
  },
  dry_cleaning: {
    title: "Химчистка",
    boxType: "detailing",
    price: { sedan: 15000, crossover: 17000, suv: 19000 },
    durationMin: { sedan: 300, crossover: 360, suv: 420 },
  },
};

/** Каталог услуг в рабочем виде: дефолт из SERVICES, поверх — правки владельца (vladislav_settings.services_config) */
export type ServiceCatalog = Record<ServiceId, Service>;

/** Правки одной услуги. Стандартная услуга: любые поля необязательны. Своя услуга: custom=true, title и boxType обязательны */
export interface ServiceOverride {
  title?: string;
  description?: string;
  hidden?: boolean;
  custom?: boolean;
  boxType?: BoxType;
  category?: string;
  icon?: string;
  sedan?: { price?: number; durationMin?: number };
  crossover?: { price?: number; durationMin?: number };
  suv?: { price?: number; durationMin?: number };
}

/** Формат services_config: { complex_wash: { sedan: { price, durationMin }, title?, hidden? }, custom_ab12: { custom: true, title, boxType, … } } */
export type ServicesConfig = Record<string, ServiceOverride>;

export const CAR_CLASSES: CarClass[] = ["sedan", "crossover", "suv"];
/** id стандартных услуг (свои услуги владельца в этот список не входят) */
export const SERVICE_IDS: string[] = Object.keys(SERVICES);

/** Допустимые значения при редактировании из админки */
export const MAX_PRICE = 1_000_000;
export const MIN_DURATION = 15;
export const MAX_DURATION = 720;
export const MAX_TITLE = 60;
export const MAX_DESC = 800;

export const isValidPrice = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_PRICE;
export const isValidDuration = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= MIN_DURATION && v <= MAX_DURATION;

const isBoxType = (v: unknown): v is BoxType => v === "washing" || v === "detailing";
const cleanText = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : undefined;

/**
 * Собирает каталог: стандартные услуги + свои услуги владельца, поверх — его правки.
 * Каждая ячейка (услуга × класс) берётся из config, если значение корректно, иначе — из каталога/по умолчанию.
 * Мусор в JSON не ломает сайт: он просто игнорируется. includeHidden=true — для админки (скрытые остаются с флагом hidden).
 */
export function resolveServices(config: unknown, includeHidden = false): ServiceCatalog {
  const cfg = (config && typeof config === "object" && !Array.isArray(config) ? config : {}) as ServicesConfig;
  const out: ServiceCatalog = {};
  const ids = [...SERVICE_IDS, ...Object.keys(cfg).filter((id) => !SERVICES[id] && cfg[id]?.custom === true)];
  for (const id of ids) {
    const o = (cfg[id] && typeof cfg[id] === "object" ? cfg[id] : {}) as ServiceOverride;
    const base = SERVICES[id];
    const title = cleanText(o.title, MAX_TITLE) ?? base?.title;
    const boxType = base?.boxType ?? (isBoxType(o.boxType) ? o.boxType : undefined);
    if (!title || !boxType) continue; // своя услуга без названия/типа бокса — игнорируем
    const dflt = base ?? { price: { sedan: 0, crossover: 0, suv: 0 }, durationMin: { sedan: 60, crossover: 60, suv: 60 } };
    const price = { ...dflt.price };
    const durationMin = { ...dflt.durationMin };
    for (const c of CAR_CLASSES) {
      const cell = o[c];
      if (isValidPrice(cell?.price)) price[c] = cell.price;
      if (isValidDuration(cell?.durationMin)) durationMin[c] = cell.durationMin;
    }
    const hidden = o.hidden === true;
    if (hidden && !includeHidden) continue;
    out[id] = {
      ...(base ?? {}),
      title,
      boxType,
      price,
      durationMin,
      description: cleanText(o.description, MAX_DESC),
      ...(base ? {} : { custom: true, category: cleanText(o.category, 40), icon: cleanText(o.icon, 30) }),
      ...(hidden ? { hidden: true } : {}),
    };
  }
  return out;
}

export const getServicePrice = (s: ServiceId, c: CarClass, catalog: ServiceCatalog = SERVICES): number =>
  catalog[s].price[c];

export const getServiceDuration = (s: ServiceId, c: CarClass, catalog: ServiceCatalog = SERVICES): number =>
  catalog[s].durationMin[c];

// ---------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------
const MIN = 60_000;

/** Локальная полночь даты YYYY-MM-DD в UTC-миллисекундах с учётом смещения. */
function localDayStartUtcMs(date: string, utcOffsetMin: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - utcOffsetMin * MIN;
}

/** Пересечение полуоткрытых интервалов [aStart, aEnd) и [bStart, bEnd). */
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && aEnd > bStart;

/** Боксы, подходящие под услугу: нужный тип и включённые (настройки владельца важнее is_active). */
export function getEligibleBoxes(
  boxes: Box[],
  serviceId: ServiceId,
  boxActive?: BoxActiveMap,
  catalog: ServiceCatalog = SERVICES,
): Box[] {
  const type = catalog[serviceId]?.boxType;
  if (!type) return []; // услуга удалена или скрыта владельцем
  return boxes
    .filter((b) => b.type === type && isBoxActive(b, boxActive))
    .sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
}

/** Свободен ли бокс на интервале [startMs, busyEndMs) (busyEnd уже с буфером). */
function isBoxFree(
  boxId: number,
  startMs: number,
  busyEndMs: number,
  busy: BusyInterval[],
): boolean {
  for (const b of busy) {
    if (b.box_id !== boxId) continue;
    if (
      overlaps(startMs, busyEndMs, Date.parse(b.start_at), Date.parse(b.busy_until))
    ) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------
// Основной генератор
// ---------------------------------------------------------------------
export interface GenerateSlotsParams {
  /** Дата в формате YYYY-MM-DD (местная) */
  date: string;
  serviceId: ServiceId;
  carClass: CarClass;
  /** Боксы (обычно BOX_DEFS); фильтрация по типу/активности внутри */
  boxes: Box[];
  /** Флаги из vladislav_settings: выключенный владельцем бокс слоты не получает */
  boxActive?: BoxActiveMap;
  /** Неотменённые заявки, пересекающие этот день (по всем боксам) */
  busy: BusyInterval[];
  /** Актуальные цены и длительность (resolveServices); по умолчанию — SERVICES */
  services?: ServiceCatalog;
  config?: Partial<SlotConfig>;
  /** Для тестов; по умолчанию текущее время */
  now?: Date;
}

export function generateSlots(params: GenerateSlotsParams): Slot[] {
  const cfg: SlotConfig = { ...DEFAULT_CONFIG, ...params.config };
  const { date, serviceId, carClass, boxes, busy, boxActive } = params;
  const nowMs = (params.now ?? new Date()).getTime();

  // 0. Выходной день недели
  const [dy, dm, dd] = date.split("-").map(Number);
  if (cfg.closedWeekdays.includes(new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay())) return [];

  // 1. Боксы нужного типа; выключенные владельцем не учитываются вообще
  const eligible = getEligibleBoxes(boxes, serviceId, boxActive, params.services);
  if (eligible.length === 0) return [];
  const durationMin = getServiceDuration(serviceId, carClass, params.services);
  const dayStart = localDayStartUtcMs(date, cfg.utcOffsetMin);
  const openMs = dayStart + cfg.openMin * MIN;
  const closeMs = dayStart + cfg.closeMin * MIN;
  const earliestMs = nowMs + cfg.minLeadMin * MIN;

  const slots: Slot[] = [];

  for (let startMs = openMs; ; startMs += cfg.stepMin * MIN) {
    const endMs = startMs + durationMin * MIN;
    const busyEndMs = endMs + cfg.bufferMin * MIN;

    // Услуга (и при необходимости буфер) должна уложиться в рабочий день
    const mustEndBy = cfg.bufferMustFitInWorkday ? busyEndMs : endMs;
    if (mustEndBy > closeMs) break;

    if (startMs < earliestMs) continue;

    // 2. Параллельность: собираем ВСЕ свободные боксы на этот момент
    const freeBoxIds = eligible
      .filter((box) => isBoxFree(box.id, startMs, busyEndMs, busy))
      .map((box) => box.id);

    if (freeBoxIds.length === 0) continue;

    slots.push({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      busyUntil: new Date(busyEndMs).toISOString(),
      boxId: freeBoxIds[0],
      freeBoxIds,
      capacity: freeBoxIds.length,
    });
  }

  return slots;
}

// ---------------------------------------------------------------------
// Повторная проверка перед созданием заявки (на сервере)
// ---------------------------------------------------------------------
/**
 * Возвращает id свободного бокса для конкретного времени или null.
 * Использовать перед insert (с СВЕЖИМИ busy и boxActive); финальную защиту от гонок даёт
 * exclusion constraint в БД (см. vladislav_hardening.sql).
 */
export function findBoxForStart(params: {
  startIso: string;
  serviceId: ServiceId;
  carClass: CarClass;
  boxes: Box[];
  boxActive?: BoxActiveMap;
  busy: BusyInterval[];
  services?: ServiceCatalog;
  bufferMin?: number;
}): number | null {
  if (!(params.services ?? SERVICES)[params.serviceId]) return null; // услугу удалили или скрыли
  const buffer = params.bufferMin ?? DEFAULT_CONFIG.bufferMin;
  const startMs = Date.parse(params.startIso);
  const busyEndMs =
    startMs + (getServiceDuration(params.serviceId, params.carClass, params.services) + buffer) * MIN;

  const box = getEligibleBoxes(params.boxes, params.serviceId, params.boxActive, params.services).find((b) =>
    isBoxFree(b.id, startMs, busyEndMs, params.busy),
  );
  return box ? box.id : null;
}

/** Границы дня для запроса занятости из БД: [from, to) в ISO. */
export function dayRangeIso(
  date: string,
  utcOffsetMin = DEFAULT_CONFIG.utcOffsetMin,
): { from: string; to: string } {
  const from = localDayStartUtcMs(date, utcOffsetMin);
  return {
    from: new Date(from).toISOString(),
    to: new Date(from + 24 * 60 * MIN).toISOString(),
  };
}
