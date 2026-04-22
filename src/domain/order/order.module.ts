import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { BonusModule } from '../bonus/bonus.module';

@Module({
  imports: [BonusModule], // Import BonusModule để sử dụng BonusService
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
