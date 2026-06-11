import { NotificationType } from 'src/prisma';

export class NotificationDto {
  userId!: string;
  message!: string;
  type!: NotificationType;
  isRead?: boolean;
  createdAt?: Date;
}
