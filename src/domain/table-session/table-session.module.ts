import { Module } from '@nestjs/common';
import { TableSessionController } from './table-session.controller';
import { TableSessionService } from './table-session.service';

@Module({
  imports: [],
  controllers: [TableSessionController],
  providers: [TableSessionService],
  exports: [TableSessionService],
})
export class TableSessionModule {}
