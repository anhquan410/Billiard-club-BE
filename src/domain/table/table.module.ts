import { Module } from '@nestjs/common';
import { TableController } from './table.controller';
import { TableService } from './table.service';
import { WebSocketModule } from 'src/websocket/websocket.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [WebSocketModule, NotificationModule],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService],
})
export class TableModule {}
