import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { TableSessionService } from './table-session.service';

@Controller('table-sessions')
export class TableSessionController {
  constructor(private readonly tableSessionService: TableSessionService) {}

  // Thêm dịch vụ vào phiên chơi
  @Post(':sessionId/add-service')
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
  async removeService(
    @Param('sessionId') sessionId: string,
    @Body() body: { serviceId: string },
  ) {
    return this.tableSessionService.removeService(sessionId, body.serviceId);
  }

  // Cập nhật số lượng dịch vụ trong phiên chơi (nếu cần)
  @Post(':sessionId/update-service-quantity/')
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
