import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { DatabaseService } from 'src/database/database.service';
import { NotificationType, UserRole, UserStatus } from 'src/prisma';
import { AuthUtils } from '../auth/utils/auth.utils';

export type NotificationPayload = {
  id: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  eventType?: string;
  bookingId?: string;
  tableId?: string;
};

type BookingNotifyData = {
  id: string;
  bookingCode: string;
  customerId?: string | null;
  customerPhone: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  table?: { tableName: string } | null;
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  private roleToNotificationType(role: UserRole): NotificationType {
    if (role === UserRole.ADMIN) return NotificationType.ADMIN;
    if (role === UserRole.CASHIER) return NotificationType.CASHIER;
    if (role === UserRole.STAFF) return NotificationType.STAFF;
    return NotificationType.USER;
  }

  private formatBookingDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private bookingSummary(data: BookingNotifyData) {
    const tableName = data.table?.tableName ?? 'bàn';
    const date = this.formatBookingDate(data.bookingDate);
    return `${tableName} ngày ${date} (${data.startTime}–${data.endTime}). Mã: ${data.bookingCode}`;
  }

  private async resolveCustomerUserId(
    customerId?: string | null,
    customerPhone?: string,
  ): Promise<string | null> {
    if (customerId) return customerId;
    if (!customerPhone?.trim()) return null;

    const raw = customerPhone.trim();
    const candidates = new Set<string>([raw]);

    try {
      candidates.add(AuthUtils.normalizePhone(raw));
    } catch {
      // ignore invalid phone format
    }

    if (raw.startsWith('0')) {
      candidates.add('+84' + raw.slice(1));
    }
    if (raw.startsWith('+84')) {
      candidates.add('0' + raw.slice(3));
    }

    const user = await this.databaseService.user.findFirst({
      where: {
        phone: { in: [...candidates] },
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });

    return user?.id ?? null;
  }

  private async notifyCustomer(
    data: BookingNotifyData,
    message: string,
    eventType: string,
  ) {
    const userId = await this.resolveCustomerUserId(
      data.customerId,
      data.customerPhone,
    );
    if (!userId) return;

    await this.createAndEmit(userId, NotificationType.USER, message, {
      eventType,
      bookingId: data.id,
    });
  }

  private async createAndEmit(
    userId: string,
    type: NotificationType,
    message: string,
    meta?: { eventType?: string; bookingId?: string; tableId?: string },
  ): Promise<NotificationPayload> {
    const notification = await this.databaseService.notification.create({
      data: {
        userId,
        type,
        message,
        isRead: false,
      },
    });

    const payload: NotificationPayload = {
      id: notification.id,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
      ...meta,
    };

    this.notificationGateway.emitToUser(userId, 'notification', payload);
    return payload;
  }

  async getMyNotifications(userId: string, limit = 30) {
    return this.databaseService.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.databaseService.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.databaseService.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return this.databaseService.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.databaseService.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  private async notifyRoles(
    roles: UserRole[],
    message: string,
    meta?: { eventType?: string; bookingId?: string; tableId?: string },
  ) {
    const users = await this.databaseService.user.findMany({
      where: { role: { in: roles } },
      select: { id: true, role: true },
    });

    for (const user of users) {
      await this.createAndEmit(
        user.id,
        this.roleToNotificationType(user.role),
        message,
        meta,
      );
    }
  }

  async sendTableStartedNotification(data: {
    tableId: string;
    tableNumber: number;
  }) {
    const message = `Bàn số ${data.tableNumber} đã được bật.`;
    await this.notifyRoles(
      [UserRole.ADMIN, UserRole.CASHIER, UserRole.STAFF],
      message,
      { eventType: 'TABLE_STARTED', tableId: data.tableId },
    );
  }

  async sendBookingCreatedNotification(
    booking: BookingNotifyData & {
      customerName: string;
    },
  ) {
    const message = `${booking.customerName} vừa đặt ${this.bookingSummary(booking)}`;

    await this.notifyRoles(
      [UserRole.ADMIN, UserRole.CASHIER, UserRole.STAFF],
      message,
      { eventType: 'BOOKING_CREATED', bookingId: booking.id },
    );
  }

  /** Khách tự đặt bàn — xác nhận đã gửi yêu cầu */
  async sendBookingSubmittedNotification(booking: BookingNotifyData) {
    const message = `Yêu cầu đặt bàn đã gửi: ${this.bookingSummary(booking)}. Vui lòng chờ quán xác nhận.`;
    await this.notifyCustomer(booking, message, 'BOOKING_SUBMITTED');
  }

  /** Admin tạo đặt bàn thay khách */
  async sendBookingRecordedNotification(booking: BookingNotifyData) {
    const message = `Quán đã ghi nhận đặt bàn: ${this.bookingSummary(booking)}. Vui lòng chờ xác nhận.`;
    await this.notifyCustomer(booking, message, 'BOOKING_RECORDED');
  }

  async sendBookingConfirmedNotification(booking: BookingNotifyData) {
    const message = `Đặt bàn thành công! ${this.bookingSummary(booking)}`;
    await this.notifyCustomer(booking, message, 'BOOKING_CONFIRMED');
  }

  async sendBookingCancelledNotification(booking: BookingNotifyData) {
    const message = `Đặt bàn đã bị hủy: ${this.bookingSummary(booking)}`;
    await this.notifyCustomer(booking, message, 'BOOKING_CANCELLED');
  }

  async sendBookingNoShowNotification(booking: BookingNotifyData) {
    const message = `Đặt bàn không đến (no-show): ${this.bookingSummary(booking)}. Bàn đã được trả trống.`;
    await this.notifyCustomer(booking, message, 'BOOKING_NO_SHOW');
  }

  async sendBookingCheckInNotification(
    booking: BookingNotifyData,
    tableName: string,
  ) {
    const message = `Check-in thành công tại ${tableName}! ${this.bookingSummary(booking)}. Chúc bạn chơi vui vẻ!`;
    await this.notifyCustomer(booking, message, 'BOOKING_CHECK_IN');
  }

  async sendTablePaymentNotification(data: {
    tableId: string;
    tableName: string;
    tableNumber: number;
    total: number;
    durationMins: number;
    orderNumber: string;
    customerId?: string | null;
    customerPhone?: string;
    customerName?: string;
  }) {
    const formattedTotal = Math.round(data.total).toLocaleString('vi-VN');
    const customerLabel = data.customerName ?? 'Khách vãng lai';
    const staffMessage = `${data.tableName} đã thanh toán ${formattedTotal}đ (${data.durationMins} phút). KH: ${customerLabel}. Mã HĐ: ${data.orderNumber}`;

    await this.notifyRoles(
      [UserRole.ADMIN, UserRole.CASHIER, UserRole.STAFF],
      staffMessage,
      { eventType: 'TABLE_PAYMENT', tableId: data.tableId },
    );

    const customerUserId = await this.resolveCustomerUserId(
      data.customerId,
      data.customerPhone,
    );
    if (customerUserId) {
      const customerMessage = `Thanh toán thành công tại ${data.tableName}. Tổng: ${formattedTotal}đ. Mã HĐ: ${data.orderNumber}`;
      await this.createAndEmit(
        customerUserId,
        NotificationType.USER,
        customerMessage,
        { eventType: 'TABLE_PAYMENT', tableId: data.tableId },
      );
    }
  }
}
