/* eslint-disable prettier/prettier */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BookingService, CHECKIN_GRACE_MINUTES } from './booking.service';

function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1017'
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class BookingSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BookingSchedulerService.name);
  private static readonly TICK_INTERVAL_MS = 60 * 1000;
  private static readonly DB_RETRY_ATTEMPTS = 3;
  private static readonly DB_RETRY_DELAY_MS = 1_500;

  constructor(private readonly bookingService: BookingService) {}

  onModuleInit() {
    void this.tick();
    setInterval(() => void this.tick(), BookingSchedulerService.TICK_INTERVAL_MS);
  }

  private async tick() {
    try {
      const count = await this.runWithDbRetry(() =>
        this.bookingService.releaseExpiredNoShowBookings(),
      );
      if (count > 0) {
        this.logger.log(
          `Tự động trả ${count} bàn (quá ${CHECKIN_GRACE_MINUTES} phút chưa check-in sau giờ đặt)`,
        );
      }
    } catch (error) {
      if (isTransientDbError(error)) {
        this.logger.warn(
          'Mất kết nối DB tạm thời khi kiểm tra đặt bàn quá hạn — sẽ thử lại ở lần quét tiếp theo',
        );
        return;
      }
      this.logger.error('Lỗi kiểm tra đặt bàn quá hạn check-in', error);
    }
  }

  private async runWithDbRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= BookingSchedulerService.DB_RETRY_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!isTransientDbError(error) || attempt === BookingSchedulerService.DB_RETRY_ATTEMPTS) {
          throw error;
        }
        this.logger.warn(
          `DB tạm ngắt kết nối (lần ${attempt}/${BookingSchedulerService.DB_RETRY_ATTEMPTS}), thử lại...`,
        );
        await sleep(BookingSchedulerService.DB_RETRY_DELAY_MS * attempt);
      }
    }
    throw lastError;
  }
}
