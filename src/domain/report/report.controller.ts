import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  getDashboard(@Query() query: ReportQueryDto) {
    return this.reportService.getDashboard(query);
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async exportDashboard(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.reportService.exportDashboard(query);
    const filename = `bao-cao-${query.fromDate}-${query.toDate}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }
}
