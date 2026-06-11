import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ id: string }>(token);
      if (!payload?.id) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.id;
      await client.join(payload.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // Room cleanup is automatic when socket disconnects
  }

  emitToUser(userId: string, event: string, payload: object) {
    this.server.to(userId).emit(event, payload);
  }
}
