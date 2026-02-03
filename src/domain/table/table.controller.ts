import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TableService } from './table.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('tables')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  // Lấy tất cả bàn
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể xem danh sách bàn
  async getAllTables() {
    const tables = await this.tableService.getAllTables();
    return tables;
  }

  // Lấy thông tin bàn theo ID
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể xem thông tin bàn
  async getTableById(@Param('id') tableId: string) {
    return this.tableService.getTableById(tableId);
  }

  // Lấy session đang active của bàn
  @Get(':id/active-session')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể xem session
  async getActiveSession(@Param('id') tableId: string) {
    return this.tableService.getActiveSession(tableId);
  }

  // Bật bàn (bắt đầu phiên chơi)
  @Post(':id/start-session')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể bật bàn
  async startSession(
    @Param('id') tableId: string,
    @Body() body: { staffId: string; note?: string },
  ) {
    return this.tableService.startSession(tableId, body.staffId, body.note);
  }

  // Tính toán preview tiền thanh toán (không lưu vào DB)
  @Post(':id/calculate-payment')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async calculatePayment(
    @Param('id') tableId: string,
    @Body() body: { discount?: number },
  ) {
    return this.tableService.calculatePayment(tableId, body.discount ?? 0);
  }

  // Thanh toán & tắt bàn
  @Post(':id/end-session')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể tắt bàn
  async endSession(
    @Param('id') tableId: string,
    @Body()
    body: {
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY' | 'OTHER';
      discount?: number;
      note?: string;
      customerId?: string;
    },
  ) {
    return this.tableService.endSession(tableId, body);
  }
}
