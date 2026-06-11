import { BookingStatus } from 'src/prisma';

/** Trước giờ đặt bao lâu thì bàn chuyển RESERVED / chặn walk-in mới */
export const BOOKING_HOLD_MINUTES_BEFORE_START = 30;

/** Check-in sớm tối đa (phút trước giờ bắt đầu) */
export const CHECKIN_EARLY_MINUTES = 15;

/** Sau giờ đặt bao lâu chưa check-in thì NO_SHOW */
export const CHECKIN_GRACE_MINUTES = 30;

export type BookingTimeSlot = {
  bookingDate: Date;
  startTime: string;
  endTime: string;
  status: BookingStatus;
};

/** Ghép ngày đặt + giờ theo múi giờ VN (UTC+7) */
export function parseBookingDateTime(bookingDate: Date, time: string): Date {
  const dateStr = bookingDate.toISOString().slice(0, 10);
  const [hour, minute] = time.split(':').map((v) => parseInt(v, 10));
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute ?? 0).padStart(2, '0');
  return new Date(`${dateStr}T${hh}:${mm}:00+07:00`);
}

export function isInHoldWindow(
  booking: Pick<BookingTimeSlot, 'bookingDate' | 'startTime'>,
  now: Date = new Date(),
): boolean {
  const startAt = parseBookingDateTime(booking.bookingDate, booking.startTime);
  const holdStart = new Date(
    startAt.getTime() - BOOKING_HOLD_MINUTES_BEFORE_START * 60 * 1000,
  );
  const noShowDeadline = new Date(
    startAt.getTime() + CHECKIN_GRACE_MINUTES * 60 * 1000,
  );
  return now >= holdStart && now < noShowDeadline;
}

export function canCheckIn(
  booking: Pick<BookingTimeSlot, 'bookingDate' | 'startTime' | 'status'>,
  now: Date = new Date(),
): boolean {
  if (booking.status !== BookingStatus.CONFIRMED) {
    return false;
  }
  const startAt = parseBookingDateTime(booking.bookingDate, booking.startTime);
  const checkInFrom = new Date(
    startAt.getTime() - CHECKIN_EARLY_MINUTES * 60 * 1000,
  );
  const checkInUntil = new Date(
    startAt.getTime() + CHECKIN_GRACE_MINUTES * 60 * 1000,
  );
  return now >= checkInFrom && now < checkInUntil;
}

export function isBookingExpiredForNoShow(
  booking: Pick<BookingTimeSlot, 'bookingDate' | 'startTime'>,
  now: Date = new Date(),
  graceMinutes = CHECKIN_GRACE_MINUTES,
): boolean {
  const startAt = parseBookingDateTime(booking.bookingDate, booking.startTime);
  const deadline = new Date(startAt.getTime() + graceMinutes * 60 * 1000);
  return now >= deadline;
}

export function timeRangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
