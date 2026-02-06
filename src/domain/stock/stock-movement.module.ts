import { Module } from '@nestjs/common';
import { StockMovementService } from './stock-movement.service';
import { StockController } from './stock-movement.controller';

@Module({
  imports: [StockModule],
  controllers: [StockController],
  providers: [StockMovementService],
  exports: [StockMovementService],
})
export class StockModule {}
