import { Module } from '@nestjs/common';
import { BonusService } from './bonus.service';
import { BonusController } from './bonus.controller';

@Module({
  controllers: [BonusController],
  providers: [BonusService],
  exports: [BonusService], // Export để OrderService có thể sử dụng
})
export class BonusModule {}
