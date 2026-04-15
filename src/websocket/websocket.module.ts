import { Module } from '@nestjs/common';
import { BilliardWebSocketGateway } from './websocket.gateway';

@Module({
  providers: [BilliardWebSocketGateway],
  exports: [BilliardWebSocketGateway],
})
export class WebSocketModule {}
