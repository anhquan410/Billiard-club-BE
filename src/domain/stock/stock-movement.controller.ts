import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StockMovementService } from './stock-movement.service';
import { StockMovementPaginationDto } from './dto/stock-movement-pagination.dto';
import { ImportStockMovementDto } from './dto/import-stock-movement.dto';
import { User } from '../auth/decorators/user.decorator';

@Controller('stocks-movement')
export class StockController {
  constructor(private readonly stockMovementService: StockMovementService) {}
  // get stock movement items
  @Get('')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  getAllStockItems(@Query() query: StockMovementPaginationDto) {
    return this.stockMovementService.getAllStockItems(query);
  }

  // import stock - nhập hàng
  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async importStock(
    @Body() body: ImportStockMovementDto,
    @User('id') staffId: string,
  ) {
    const { productId, quantity, unitPrice, reason } = body;
    return this.stockMovementService.importStock(
      productId,
      quantity,
      unitPrice,
      staffId,
      reason,
    );
  }
}
