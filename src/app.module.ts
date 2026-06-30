import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './domain/user/user.module';
import { AuthModule } from './domain/auth/auth.module';
import { ProductModule } from './domain/product/product.module';
import { TableModule } from './domain/table/table.module';
import { TableSessionModule } from './domain/table-session/table-session.module';
import { StockModule } from './domain/stock/stock-movement.module';
import { OrderModule } from './domain/order/order.module';
import { BonusModule } from './domain/bonus/bonus.module';
import { WebSocketModule } from './websocket/websocket.module';

import { NotificationModule } from './domain/notification/notification.module';
import { ReportModule } from './domain/report/report.module';
import { AccountingModule } from './domain/accounting/accounting.module';
import { BookingModule } from './domain/booking/booking.module';
import { TaskModule } from './domain/task/task.module';
import { WorkScheduleModule } from './domain/work-schedule/work-schedule.module';
import { PayrollModule } from './domain/payroll/payroll.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    AuthModule,
    ProductModule,
    TableModule,
    TableSessionModule,
    StockModule,
    OrderModule,
    BonusModule,
    WebSocketModule,
    NotificationModule,
    ReportModule,
    AccountingModule,
    BookingModule,
    TaskModule,
    WorkScheduleModule,
    PayrollModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
