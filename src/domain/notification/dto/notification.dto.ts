import { NotificationType } from '@prisma/client';

export class NotificationDto {
  userId!: string;
  message!: string;
  type!: NotificationType;
  isRead?: boolean;
  createdAt?: Date;
}
