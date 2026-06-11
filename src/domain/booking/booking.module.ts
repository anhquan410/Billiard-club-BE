import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingSchedulerService } from './booking-scheduler.service';
import { BookingService } from './booking.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [BookingController],
  providers: [BookingService, BookingSchedulerService],
  exports: [BookingService],
})
export class BookingModule {}
