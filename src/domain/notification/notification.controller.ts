import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { User } from '../auth/decorators/user.decorator';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getMyNotifications(
    @User('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 30, 100) : 30;
    return this.notificationService.getMyNotifications(userId, parsedLimit);
  }

  @Get('unread-count')
  getUnreadCount(@User('id') userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch('read-all')
  markAllAsRead(@User('id') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  markAsRead(@User('id') userId: string, @Param('id') id: string) {
    return this.notificationService.markAsRead(userId, id);
  }
}
