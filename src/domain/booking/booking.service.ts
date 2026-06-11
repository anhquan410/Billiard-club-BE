/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, TableStatus } from 'src/prisma';
import { DatabaseService } from 'src/database/database.service';
import { NotificationService } from '../notification/notification.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CustomerCreateBookingDto } from './dto/customer-create-booking.dto';
import {
  BOOKING_HOLD_MINUTES_BEFORE_START,
  canCheckIn,
  CHECKIN_EARLY_MINUTES,
  CHECKIN_GRACE_MINUTES,
  isBookingExpiredForNoShow,
  isInHoldWindow,
  parseBookingDateTime,
  timeRangesOverlap,
} from './booking-policy';

export {
  BOOKING_HOLD_MINUTES_BEFORE_START,
  CHECKIN_EARLY_MINUTES,
  CHECKIN_GRACE_MINUTES,
};

@Injectable()
export class BookingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * CONFIRMED chưa check-in, quá giờ bắt đầu + grace → NO_SHOW.
   */
  async releaseExpiredNoShowBookings(
    graceMinutes = CHECKIN_GRACE_MINUTES,
  ): Promise<number> {
    const bookings = await this.databaseService.tableBooking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        session: { is: null },
      },
    });

    const now = new Date();
    let released = 0;

    for (const booking of bookings) {
      if (isBookingExpiredForNoShow(booking, now, graceMinutes)) {
        await this.markNoShow(booking.id);
        released++;
      }
    }

    return released;
  }

  /**
   * Đồng bộ RESERVED theo khung giữ chỗ (chỉ khi bàn không OCCUPIED).
   */
  async syncAllTableReservationStatuses(): Promise<void> {
    const tables = await this.databaseService.table.findMany({
      where: { status: { not: TableStatus.OCCUPIED } },
      select: { id: true },
    });

    for (const table of tables) {
      await this.syncTableReservationStatus(table.id);
    }
  }

  async syncTableReservationStatus(tableId: string): Promise<void> {
    const table = await this.databaseService.table.findUnique({
      where: { id: tableId },
    });
    if (!table || table.status === TableStatus.OCCUPIED) {
      return;
    }

    const holdBooking = await this.findHoldWindowBooking(tableId);

    if (holdBooking) {
      if (table.status !== TableStatus.RESERVED) {
        await this.databaseService.table.update({
          where: { id: tableId },
          data: { status: TableStatus.RESERVED },
        });
      }
      return;
    }

    if (table.status === TableStatus.RESERVED) {
      await this.databaseService.table.update({
        where: { id: tableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }
  }

  async assertWalkInAllowed(tableId: string): Promise<void> {
    const holdBooking = await this.findHoldWindowBooking(tableId);
    if (!holdBooking) {
      return;
    }

    const startAt = parseBookingDateTime(
      holdBooking.bookingDate,
      holdBooking.startTime,
    );
    throw new BadRequestException(
      `Bàn đang giữ chỗ cho đặt bàn ${holdBooking.bookingCode} (${holdBooking.startTime}–${holdBooking.endTime}, khách ${holdBooking.customerName}). ` +
        `Chỉ có thể check-in đặt bàn từ ${CHECKIN_EARLY_MINUTES} phút trước ${startAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}.`,
    );
  }

  assertCheckInAllowed(booking: {
    status: BookingStatus;
    bookingDate: Date;
    startTime: string;
    endTime: string;
    bookingCode: string;
  }): void {
    if (!canCheckIn(booking)) {
      const startAt = parseBookingDateTime(booking.bookingDate, booking.startTime);
      throw new BadRequestException(
        `Chưa đến khung giờ check-in cho đặt bàn ${booking.bookingCode}. ` +
          `Check-in từ ${CHECKIN_EARLY_MINUTES} phút trước ${booking.startTime} đến ${CHECKIN_GRACE_MINUTES} phút sau giờ đặt (${startAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}).`,
      );
    }
  }

  async getUpcomingBookingForTable(tableId: string) {
    const now = new Date();
    const bookings = await this.databaseService.tableBooking.findMany({
      where: {
        tableId,
        status: BookingStatus.CONFIRMED,
        session: { is: null },
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    });

    for (const booking of bookings) {
      const startAt = parseBookingDateTime(booking.bookingDate, booking.startTime);
      if (startAt > now && !isInHoldWindow(booking, now)) {
        return booking;
      }
    }

    return null;
  }

  private async findHoldWindowBooking(tableId: string) {
    const bookings = await this.databaseService.tableBooking.findMany({
      where: {
        tableId,
        status: BookingStatus.CONFIRMED,
        session: { is: null },
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    });

    const now = new Date();
    return bookings.find((b) => isInHoldWindow(b, now)) ?? null;
  }

  async getDashboard(query: BookingQueryDto) {
    await this.releaseExpiredNoShowBookings();
    await this.syncAllTableReservationStatuses();

    const date = query.date ?? new Date().toISOString().slice(0, 10);
    const dateStart = new Date(`${date}T00:00:00.000Z`);

    const where: Prisma.TableBookingWhereInput = {};

    if (query.date) {
      where.bookingDate = dateStart;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerPhone: { contains: query.search, mode: 'insensitive' } },
        { bookingCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [bookings, allBookingsForSummary, availableTables] =
      await Promise.all([
        this.databaseService.tableBooking.findMany({
          where,
          include: {
            table: true,
            confirmedBy: { select: { fullName: true } },
            session: { select: { id: true } },
          },
          orderBy: [
            { bookingDate: 'desc' },
            { startTime: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        this.databaseService.tableBooking.findMany({
          select: { status: true, bookingDate: true },
        }),
        this.databaseService.table.findMany({
          where: { status: TableStatus.AVAILABLE },
          orderBy: { tableNumber: 'asc' },
        }),
      ]);

    const todayIso = new Date().toISOString().slice(0, 10);
    const summary = {
      total: allBookingsForSummary.length,
      pending: allBookingsForSummary.filter(
        (b) => b.status === BookingStatus.PENDING,
      ).length,
      confirmed: allBookingsForSummary.filter(
        (b) => b.status === BookingStatus.CONFIRMED,
      ).length,
      completed: allBookingsForSummary.filter(
        (b) => b.status === BookingStatus.COMPLETED,
      ).length,
      cancelled: allBookingsForSummary.filter(
        (b) =>
          b.status === BookingStatus.CANCELLED ||
          b.status === BookingStatus.NO_SHOW,
      ).length,
      todayBookings: allBookingsForSummary.filter(
        (b) => b.bookingDate.toISOString().slice(0, 10) === todayIso,
      ).length,
    };

    return {
      date,
      summary,
      bookings: bookings.map((booking) => this.mapBooking(booking)),
      availableTables: availableTables.map((table) => ({
        id: table.id,
        tableName: table.tableName,
        hourlyRate: Math.round(Number(table.hourlyRate)),
      })),
    };
  }

  async getMyBookings(customerId: string) {
    await this.releaseExpiredNoShowBookings();

    const user = await this.databaseService.user.findUnique({
      where: { id: customerId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const [bookings, availableTables] = await Promise.all([
      this.databaseService.tableBooking.findMany({
        where: {
          OR: [{ customerId }, { customerPhone: user.phone }],
        },
        include: {
          table: true,
          confirmedBy: { select: { fullName: true } },
          session: { select: { id: true } },
        },
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      }),
      this.databaseService.table.findMany({
        where: { status: TableStatus.AVAILABLE },
        orderBy: { tableNumber: 'asc' },
      }),
    ]);

    return {
      bookings: bookings.map((booking) => ({
        ...this.mapBooking(booking),
        canCancel: this.canCustomerCancelBooking(booking),
      })),
      availableTables: availableTables.map((table) => ({
        id: table.id,
        tableName: table.tableName,
        hourlyRate: Math.round(Number(table.hourlyRate)),
      })),
    };
  }

  async createCustomerBooking(
    customerId: string,
    dto: CustomerCreateBookingDto,
  ) {
    const user = await this.databaseService.user.findUnique({
      where: { id: customerId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    return this.createBooking(
      {
        customerName: user.fullName,
        customerPhone: user.phone,
        tableId: dto.tableId,
        bookingDate: dto.bookingDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        guestCount: dto.guestCount,
        note: dto.note,
      },
      customerId,
    );
  }

  async createBooking(dto: CreateBookingDto, customerId?: string) {
    await this.assertNoBookingConflict(
      dto.tableId,
      dto.bookingDate,
      dto.startTime,
      dto.endTime,
    );

    const code = await this.generateBookingCode();
    const booking = await this.databaseService.tableBooking.create({
      data: {
        bookingCode: code,
        customerId: customerId ?? null,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        tableId: dto.tableId,
        bookingDate: new Date(`${dto.bookingDate}T00:00:00.000Z`),
        startTime: dto.startTime,
        endTime: dto.endTime,
        guestCount: dto.guestCount,
        depositAmount: new Prisma.Decimal(dto.depositAmount ?? 0),
        note: dto.note,
      },
      include: {
        table: true,
        confirmedBy: { select: { fullName: true } },
      },
    });

    if (customerId) {
      await this.notificationService.sendBookingCreatedNotification(booking);
      await this.notificationService.sendBookingSubmittedNotification(booking);
    } else {
      await this.notificationService.sendBookingRecordedNotification(booking);
    }

    return this.mapBooking(booking);
  }

  async confirmBooking(id: string, userId: string) {
    const booking = await this.findBookingOrThrow(id);

    await this.assertNoBookingConflict(
      booking.tableId,
      booking.bookingDate.toISOString().slice(0, 10),
      booking.startTime,
      booking.endTime,
      booking.id,
    );

    const updated = await this.databaseService.tableBooking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        confirmedById: userId,
      },
      include: {
        table: true,
        confirmedBy: { select: { fullName: true } },
      },
    });

    await this.syncTableReservationStatus(booking.tableId);

    await this.notificationService.sendBookingConfirmedNotification(updated);

    return this.mapBooking(updated);
  }

  async getConfirmedBookingForTable(tableId: string) {
    await this.releaseExpiredNoShowBookings();
    await this.syncTableReservationStatus(tableId);

    const bookings = await this.databaseService.tableBooking.findMany({
      where: {
        tableId,
        status: BookingStatus.CONFIRMED,
        session: { is: null },
      },
      include: {
        table: true,
        confirmedBy: { select: { fullName: true } },
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    });

    const eligible = bookings.find((b) => canCheckIn(b));
    if (!eligible) {
      return null;
    }

    return this.mapBooking(eligible);
  }

  async markNoShow(id: string) {
    const booking = await this.findBookingOrThrow(id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Chỉ đánh dấu không đến với đặt bàn đã xác nhận',
      );
    }
    if (await this.hasCheckedInSession(booking.id)) {
      throw new BadRequestException(
        'Không thể đánh dấu không đến khi khách đã check-in',
      );
    }

    const updated = await this.databaseService.$transaction(async (tx) => {
      const result = await tx.tableBooking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.NO_SHOW },
        include: {
          table: true,
          confirmedBy: { select: { fullName: true } },
        },
      });

      return result;
    });

    await this.syncTableReservationStatus(booking.tableId);

    await this.notificationService.sendBookingNoShowNotification(updated);

    return this.mapBooking(updated);
  }

  async cancelBooking(id: string, userId?: string, role?: string) {
    const booking = await this.databaseService.tableBooking.findUnique({
      where: { id },
      include: {
        table: true,
        confirmedBy: { select: { fullName: true } },
        session: { select: { id: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đặt bàn');
    }

    if (booking.session) {
      throw new BadRequestException(
        'Không thể hủy đặt bàn đã check-in. Vui lòng xử lý tại Thu ngân.',
      );
    }

    if (role === 'CUSTOMER') {
      if (!userId) {
        throw new ForbiddenException('Bạn chỉ được hủy đặt bàn của mình');
      }

      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
      });
      const isOwner =
        booking.customerId === userId ||
        (!!user?.phone && booking.customerPhone === user.phone);

      if (!isOwner) {
        throw new ForbiddenException('Bạn chỉ được hủy đặt bàn của mình');
      }

      if (!this.canCustomerCancelBooking(booking)) {
        throw new BadRequestException(
          'Không thể hủy đặt bàn đã check-in hoặc đã kết thúc',
        );
      }
    }

    const updated = await this.databaseService.$transaction(async (tx) => {
      const result = await tx.tableBooking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
        include: {
          table: true,
          confirmedBy: { select: { fullName: true } },
        },
      });

      return result;
    });

    await this.syncTableReservationStatus(booking.tableId);

    if (role && role !== 'CUSTOMER') {
      await this.notificationService.sendBookingCancelledNotification(updated);
    }

    return this.mapBooking(updated);
  }

  private async assertNoBookingConflict(
    tableId: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ) {
    const date = new Date(`${bookingDate}T00:00:00.000Z`);
    const newStart = parseBookingDateTime(date, startTime);
    const newEnd = parseBookingDateTime(date, endTime);

    if (newEnd <= newStart) {
      throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
    }

    const existing = await this.databaseService.tableBooking.findMany({
      where: {
        tableId,
        bookingDate: date,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    });

    for (const b of existing) {
      const bStart = parseBookingDateTime(b.bookingDate, b.startTime);
      const bEnd = parseBookingDateTime(b.bookingDate, b.endTime);
      if (timeRangesOverlap(newStart, newEnd, bStart, bEnd)) {
        throw new BadRequestException(
          `Trùng khung giờ với đặt bàn ${b.bookingCode} (${b.startTime}–${b.endTime})`,
        );
      }
    }
  }

  private canCustomerCancelBooking(booking: {
    status: BookingStatus;
    session?: { id: string } | null;
  }) {
    return (
      booking.status === BookingStatus.PENDING ||
      (booking.status === BookingStatus.CONFIRMED && !booking.session)
    );
  }

  private async hasCheckedInSession(bookingId: string): Promise<boolean> {
    const session = await this.databaseService.tableSession.findFirst({
      where: { bookingId },
      select: { id: true },
    });
    return !!session;
  }

  private async findBookingOrThrow(id: string) {
    const booking = await this.databaseService.tableBooking.findUnique({
      where: { id },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đặt bàn');
    }
    return booking;
  }

  private mapBooking(booking: {
    id: string;
    bookingCode: string;
    customerName: string;
    customerPhone: string;
    tableId: string;
    table: { tableName: string };
    bookingDate: Date;
    startTime: string;
    endTime: string;
    guestCount: number;
    depositAmount: Prisma.Decimal;
    note: string | null;
    status: BookingStatus;
    createdAt: Date;
    confirmedBy: { fullName: string } | null;
    session?: { id: string } | null;
  }) {
    const hasCheckedIn = !!booking.session;
    return {
      id: booking.id,
      bookingCode: booking.bookingCode,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      tableId: booking.tableId,
      tableName: booking.table.tableName,
      bookingDate: booking.bookingDate.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime,
      guestCount: booking.guestCount,
      depositAmount: Math.round(Number(booking.depositAmount)),
      note: booking.note ?? undefined,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
      confirmedBy: booking.confirmedBy?.fullName,
      hasCheckedIn,
    };
  }

  private async generateBookingCode() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const count = await this.databaseService.tableBooking.count({
      where: { bookingCode: { startsWith: `DB-${today}` } },
    });
    return `DB-${today}-${String(count + 1).padStart(3, '0')}`;
  }
}
