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

/** Số phút sau giờ bắt đầu đặt bàn mà chưa check-in thì tự trả bàn */
export const CHECKIN_GRACE_MINUTES = 30;

@Injectable()
export class BookingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Đặt bàn CONFIRMED + bàn RESERVED nhưng chưa check-in:
   * quá giờ bắt đầu + grace → NO_SHOW và bàn về AVAILABLE.
   * VD: đặt 18:00, đến 18:30 chưa bật bàn → tự động trả trống.
   */
  async releaseExpiredNoShowBookings(
    graceMinutes = CHECKIN_GRACE_MINUTES,
  ): Promise<number> {
    const bookings = await this.databaseService.tableBooking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        session: { is: null },
        table: { status: TableStatus.RESERVED },
      },
    });

    const now = new Date();
    let released = 0;

    for (const booking of bookings) {
      const startAt = this.parseBookingDateTime(
        booking.bookingDate,
        booking.startTime,
      );
      const deadline = new Date(startAt.getTime() + graceMinutes * 60 * 1000);

      if (now >= deadline) {
        await this.markNoShow(booking.id);
        released++;
      }
    }

    return released;
  }

  async getDashboard(query: BookingQueryDto) {
    await this.releaseExpiredNoShowBookings();
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
          },
          orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
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

    await this.databaseService.table.update({
      where: { id: booking.tableId },
      data: { status: TableStatus.RESERVED },
    });

    await this.notificationService.sendBookingConfirmedNotification(updated);

    return this.mapBooking(updated);
  }

  async getConfirmedBookingForTable(tableId: string) {
    await this.releaseExpiredNoShowBookings();

    const booking = await this.databaseService.tableBooking.findFirst({
      where: {
        tableId,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        table: true,
        confirmedBy: { select: { fullName: true } },
      },
      orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
    });

    if (!booking) {
      return null;
    }

    return this.mapBooking(booking);
  }

  async markNoShow(id: string) {
    const booking = await this.findBookingOrThrow(id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Chỉ đánh dấu không đến với đặt bàn đã xác nhận',
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

      await tx.table.updateMany({
        where: { id: booking.tableId, status: TableStatus.RESERVED },
        data: { status: TableStatus.AVAILABLE },
      });

      return result;
    });

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

    const wasConfirmed = booking.status === BookingStatus.CONFIRMED;

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

      if (wasConfirmed) {
        await tx.table.updateMany({
          where: { id: booking.tableId, status: TableStatus.RESERVED },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      return result;
    });

    if (role && role !== 'CUSTOMER') {
      await this.notificationService.sendBookingCancelledNotification(updated);
    }

    return this.mapBooking(updated);
  }

  /** Ghép ngày đặt + giờ bắt đầu theo múi giờ VN (UTC+7) */
  private parseBookingDateTime(bookingDate: Date, time: string): Date {
    const dateStr = bookingDate.toISOString().slice(0, 10);
    const [hour, minute] = time.split(':').map((v) => parseInt(v, 10));
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return new Date(`${dateStr}T${hh}:${mm}:00+07:00`);
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
  }) {
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
