import { Injectable } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { DatabaseService } from 'src/database/database.service';
import { NotificationType } from 'src/prisma';

@Injectable()
export class NotificationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  // Gửi thông báo khi bật bàn cho tất cả ADMIN, CASHIER, STAFF
  async sendTableStartedNotification(data: {
    tableId: string;
    tableNumber: number;
  }) {
    const message = `Bàn số ${data.tableNumber} đã được bật.`;

    // Lấy danh sách user cần nhận thông báo
    const users = await this.databaseService.user.findMany({
      where: { role: { in: ['ADMIN', 'CASHIER', 'STAFF'] } },
      select: { id: true, role: true },
    });

    for (const user of users) {
      // Xác định loại thông báo theo role
      const type: NotificationType =
        user.role === 'ADMIN'
          ? NotificationType.ADMIN
          : user.role === 'CASHIER'
            ? NotificationType.CASHIER
            : NotificationType.STAFF;

      // Lưu vào DB
      await this.databaseService.notification.create({
        data: {
          userId: user.id,
          type,
          message,
          isRead: false,
        },
      });

      // Emit thông báo riêng cho từng user qua websocket
      this.notificationGateway.emitToUser(user.id, 'notification', {
        message,
        type: 'TABLE_STARTED',
        tableId: data.tableId,
      });
    }
  }
}
