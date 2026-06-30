import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreatePayrollAdjustmentDto,
  PayrollAdjustmentQueryDto,
  PayrollMonthQueryDto,
  UpdatePayrollAdjustmentDto,
  UpdatePayrollSettingsDto,
} from './dto/payroll.dto';
import { PayrollService } from './payroll.service';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('settings')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getSettings() {
    return this.payrollService.getSettings();
  }

  @Put('settings')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateSettings(@Body() body: UpdatePayrollSettingsDto) {
    return this.payrollService.updateSettings(body);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('CASHIER', 'STAFF')
  getMyPayroll(
    @User('id') userId: string,
    @Query() query: PayrollMonthQueryDto,
  ) {
    return this.payrollService.getMyPayroll(userId, query.month);
  }

  @Get('admin/summary')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAdminSummary(@Query() query: PayrollMonthQueryDto) {
    return this.payrollService.getAdminSummary(query.month);
  }

  @Get('admin/users/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getUserPayroll(
    @Param('userId') userId: string,
    @Query() query: PayrollMonthQueryDto,
  ) {
    return this.payrollService.getUserPayroll(userId, query.month);
  }

  @Post('admin/adjustments')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createAdjustment(
    @User('id') adminId: string,
    @Body() body: CreatePayrollAdjustmentDto,
  ) {
    return this.payrollService.createAdjustment(adminId, body);
  }

  @Patch('admin/adjustments/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateAdjustment(
    @Param('id') id: string,
    @Body() body: UpdatePayrollAdjustmentDto,
  ) {
    return this.payrollService.updateAdjustment(id, body);
  }

  @Delete('admin/adjustments/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteAdjustment(@Param('id') id: string) {
    return this.payrollService.deleteAdjustment(id);
  }

  @Get('adjustments')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  getAdjustments(
    @Query() query: PayrollAdjustmentQueryDto,
    @User() user: { id: string; role: string },
  ) {
    const userId = user.role === 'ADMIN' ? query.userId : user.id;
    if (user.role !== 'ADMIN') {
      this.payrollService.assertCanViewPayroll(user, user.id);
    }
    return this.payrollService.getAdjustments(query.month, userId);
  }
}
