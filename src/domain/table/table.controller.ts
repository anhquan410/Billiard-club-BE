import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TableService } from './table.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller('tables')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  // Lấy tất cả bàn
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF', 'CUSTOMER')
  async getAllTables() {
    const tables = await this.tableService.getAllTables();
    return tables;
  }

  // Lấy thông tin bàn theo ID
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  async getTableById(@Param('id') tableId: string) {
    return this.tableService.getTableById(tableId);
  }

  // Lấy session đang active của bàn
  @Get(':id/active-session')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  async getActiveSession(@Param('id') tableId: string) {
    return this.tableService.getActiveSession(tableId);
  }

  // Bật bàn (bắt đầu phiên chơi)
  @Post(':id/start-session')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER')
  async startSession(
    @Param('id') tableId: string,
    @User('id') userId: string,
    @Body() body: { note?: string; bookingId?: string },
  ) {
    return this.tableService.startSession(
      tableId,
      userId,
      body.note,
      body.bookingId,
    );
  }

  // Gắn khách hàng vào phiên chơi đang active
  @Patch(':id/active-session/assign-customer')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  async assignCustomer(
    @Body() body: { sessionId: string; customerId: string | null },
  ) {
    return this.tableService.assignCustomer(body.sessionId, body.customerId);
  }

  // Gắn nhân viên phục vụ vào phiên chơi (Admin hoặc Cashier)
  @Patch(':id/active-session/assign-staff')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER')
  async assignStaff(
    @Param('id') tableId: string,
    @Body() body: { sessionId: string; staffId: string | null },
  ) {
    return this.tableService.assignStaff(body.sessionId, body.staffId);
  }

  // Thay đổi cashier gắn với phiên chơi (Chỉ Admin)
  @Patch(':id/active-session/change-cashier')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async changeCashier(
    @Param('id') tableId: string,
    @Body() body: { sessionId: string; cashierId: string },
  ) {
    return this.tableService.changeCashier(body.sessionId, body.cashierId);
  }

  // Tính toán preview tiền thanh toán (không lưu vào DB)
  @Post(':id/calculate-payment')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER')
  async calculatePayment(
    @Param('id') tableId: string,
    @Body() body: { discount?: number },
  ) {
    return this.tableService.calculatePayment(tableId, body.discount ?? 0);
  }

  // Thanh toán & tắt bàn
  @Post(':id/end-session')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER')
  async endSession(
    @Param('id') tableId: string,
    @User('id') userId: string,
    @Body()
    body: {
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY' | 'OTHER';
      discount?: number;
      note?: string;
      customerId?: string;
      bonusPointsToUse?: number;
      useTierDiscount?: boolean;
    },
  ) {
    return this.tableService.endSession(tableId, userId, body);
  }
}
