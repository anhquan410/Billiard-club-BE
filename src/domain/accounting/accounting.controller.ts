import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AccountingService } from './accounting.service';
import { AccountingQueryDto } from './dto/accounting-query.dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  getDashboard(@Query() query: AccountingQueryDto) {
    return this.accountingService.getDashboard(query);
  }

  @Post('transactions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  createTransaction(
    @Body() body: CreateTransactionDto,
    @User('id') userId: string,
  ) {
    return this.accountingService.createTransaction(body, userId);
  }

  @Post('debts')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  createDebt(@Body() body: CreateDebtDto) {
    return this.accountingService.createDebt(body);
  }
}
