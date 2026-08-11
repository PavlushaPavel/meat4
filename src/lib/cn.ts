/** Склеивает список классов, отбрасывая ложные значения. Без внешних зависимостей. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}
