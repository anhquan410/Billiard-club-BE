export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

const vnDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const vnWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: VN_TIMEZONE,
  weekday: 'short',
});

/** YYYY-MM-DD in Vietnam timezone */
export function toVnDateString(date: Date = new Date()): string {
  return vnDateFormatter.format(date);
}

export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getVnWeekday(date: Date = new Date()): number {
  const weekday = vnWeekdayFormatter.format(date);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };
  return map[weekday] ?? 0;
}

export function isSundayInVn(date: Date = new Date()): boolean {
  return getVnWeekday(date) === 0;
}

/** Monday of the week containing `date` (VN), as UTC date-only */
export function getWeekStart(date: Date = new Date()): Date {
  const dateStr = toVnDateString(date);
  const current = parseDateOnly(dateStr);
  const weekday = getVnWeekday(date);
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  current.setUTCDate(current.getUTCDate() - daysFromMonday);
  return current;
}

/** Next Monday after today (VN). On Sunday = tomorrow. */
export function getNextWeekStart(from: Date = new Date()): Date {
  const dateStr = toVnDateString(from);
  const current = parseDateOnly(dateStr);
  const weekday = getVnWeekday(from);
  const daysUntilNextMonday = weekday === 0 ? 1 : 8 - weekday;
  current.setUTCDate(current.getUTCDate() + daysUntilNextMonday);
  return current;
}

/** weekStart employees may register for (only valid on Sunday = next Monday) */
export function getRegistrationWeekStart(from: Date = new Date()): Date {
  return getNextWeekStart(from);
}

export function isRegistrationOpen(now: Date = new Date()): boolean {
  return isSundayInVn(now);
}

export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getMonthRange(monthStr: string): { start: Date; end: Date } {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}
