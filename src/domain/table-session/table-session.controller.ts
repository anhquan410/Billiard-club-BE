import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TableSessionService } from './table-session.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('table-sessions')
@UseGuards(RolesGuard)
export class TableSessionController {
  constructor(private readonly tableSessionService: TableSessionService) {}

  // Thêm dịch vụ vào phiên chơi
  @Post(':sessionId/add-service')
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  async addService(
    @Param('sessionId') sessionId: string,
    @Body() body: { productId: string; quantity?: number; price?: number },
  ) {
    return this.tableSessionService.addService(
      sessionId,
      body.productId,
      body.quantity,
      body.price,
    );
  }

  // Xóa dịch vụ khỏi phiên chơi (nếu cần)
  @Delete(':sessionId/remove-service')
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  async removeService(
    @Param('sessionId') sessionId: string,
    @Body() body: { serviceId: string },
  ) {
    return this.tableSessionService.removeService(sessionId, body.serviceId);
  }

  // Cập nhật số lượng dịch vụ trong phiên chơi (nếu cần)
  @Post(':sessionId/update-service-quantity/')
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  async updateServiceQuantity(
    @Param('sessionId') sessionId: string,
    @Body() body: { serviceId: string; quantity: number },
  ) {
    return this.tableSessionService.updateServiceQuantity(
      sessionId,
      body.serviceId,
      body.quantity,
    );
  }
}
