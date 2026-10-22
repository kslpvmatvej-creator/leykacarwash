/** 1 гость, 2–4 гостя, 5+ гостей (11–14 → гостей) */
export const pluralGuests = (n: number) => {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'гостей'
  if (mod10 === 1) return 'гость'
  if (mod10 >= 2 && mod10 <= 4) return 'гостя'
  return 'гостей'
}

/** 1 человек, 2–4 человека, 5+ человек */
export const pluralPeople = (n: number) => {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'человек'
  if (mod10 >= 2 && mod10 <= 4) return 'человека'
  return 'человек'
}

/** 1 день, 2–4 дня, 5+ дней */
export const pluralDays = (n: number) => {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}

/** Универсальное склонение: plural(3, 'бокс', 'бокса', 'боксов') → «бокса» */
export const plural = (n: number, one: string, few: string, many: string) => {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
