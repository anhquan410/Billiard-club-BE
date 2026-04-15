/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173', // Cho phép Frontend kết nối từ port 5173
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class BilliardWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private logger = new Logger('BilliardWebSocketGateway');

  @WebSocketServer()
  server!: Server;

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emit sự kiện khi có bàn được bật (start session)
  emitTableStarted(tableData: {
    tableId: string;
    tableNumber: number;
    status: string;
    sessionId: string;
  }) {
    this.server?.emit('tableStarted', tableData);
    this.logger.log(
      `Table ${tableData.tableNumber} started - emitted to all clients`,
    );
  }

  // Emit sự kiện khi có bàn được tắt (end session)
  emitTableEnded(tableData: {
    tableId: string;
    tableNumber: number;
    status: string;
  }) {
    this.server?.emit('tableEnded', tableData);
    this.logger.log(
      `Table ${tableData.tableNumber} ended - emitted to all clients`,
    );
  }

  // Emit sự kiện khi có thay đổi trạng thái bàn bất kỳ
  emitTableStatusChanged(tableData: {
    tableId: string;
    tableNumber: number;
    status: string;
    sessionId?: string;
  }) {
    this.server?.emit('tableStatusChanged', tableData);
    this.logger.log(
      `Table ${tableData.tableNumber} status changed to ${tableData.status}`,
    );
  }
}
