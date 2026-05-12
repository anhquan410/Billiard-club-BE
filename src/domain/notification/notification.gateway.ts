import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class NotificationGateway {
  @WebSocketServer()
  server!: Server;

  // Emit thông báo khi bật bàn (broadcast cho tất cả client)
  emitTableStarted(data: { tableId: string; tableNumber: number }) {
    this.server.emit('table_started', {
      message: `Bàn số ${data.tableNumber} đã được bật.`,
      tableId: data.tableId,
    });
  }

  // Emit thông báo cá nhân cho từng user (theo userId từ client join room)
  emitToUser(userId: string, event: string, payload: object) {
    this.server.to(userId).emit(event, payload);
  }
}
