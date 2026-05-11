export class NotificationDto {
  userId: string;
  message: string;
  type: 'user' | 'staff' | 'admin' | 'cashier';
  isRead?: boolean;
  createdAt?: Date;
}
