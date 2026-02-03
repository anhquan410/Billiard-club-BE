import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './domain/user/user.module';
import { AuthModule } from './domain/auth/auth.module';
import { ProductModule } from './domain/product/product.module';
import { TableModule } from './domain/table/table.module';
import { TableSessionModule } from './domain/table-session/table-session.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    AuthModule,
    ProductModule,
    TableModule,
    TableSessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
