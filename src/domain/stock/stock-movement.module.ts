import { Module } from '@nestjs/common';
import { StockMovementService } from './stock-movement.service';
import { StockController } from './stock-movement.controller';

@Module({
  imports: [],
  controllers: [StockController],
  providers: [StockMovementService],
  exports: [StockMovementService],
})
export class StockModule {}
