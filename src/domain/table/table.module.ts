import { Module } from '@nestjs/common';
import { TableController } from './table.controller';
import { TableService } from './table.service';
import { WebSocketModule } from 'src/websocket/websocket.module';
import { NotificationModule } from '../notification/notification.module';
import { BookingModule } from '../booking/booking.module';
import { BonusModule } from '../bonus/bonus.module';

@Module({
  imports: [WebSocketModule, NotificationModule, BookingModule, BonusModule],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService],
})
export class TableModule {}
