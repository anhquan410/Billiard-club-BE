import {
  Body,
  Controller,
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
  AdminSaveScheduleDto,
  RejectScheduleDto,
  SaveScheduleDto,
  ScheduleQueryDto,
} from './dto/save-schedule.dto';
import { WorkScheduleService } from './work-schedule.service';

@Controller('work-schedule')
export class WorkScheduleController {
  constructor(private readonly workScheduleService: WorkScheduleService) {}

  @Get('registration-window')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  getRegistrationWindow() {
    return this.workScheduleService.getRegistrationWindow();
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('CASHIER', 'STAFF')
  getMySchedule(@User('id') userId: string, @Query() query: ScheduleQueryDto) {
    return this.workScheduleService.getMySchedule(userId, query.weekStart);
  }

  @Put('my')
  @UseGuards(RolesGuard)
  @Roles('CASHIER', 'STAFF')
  saveMySchedule(@User('id') userId: string, @Body() body: SaveScheduleDto) {
    return this.workScheduleService.saveMySchedule(userId, body);
  }

  @Post('my/submit')
  @UseGuards(RolesGuard)
  @Roles('CASHIER', 'STAFF')
  submitMySchedule(@User('id') userId: string, @Body() body: ScheduleQueryDto) {
    return this.workScheduleService.submitMySchedule(userId, body.weekStart);
  }

  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getPending() {
    return this.workScheduleService.getPendingSchedules();
  }

  @Get('admin/overview')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getOverview(@Query() query: ScheduleQueryDto) {
    return this.workScheduleService.getOverview(query.weekStart);
  }

  @Get('admin/user/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getUserSchedule(
    @Param('userId') userId: string,
    @Query() query: ScheduleQueryDto,
  ) {
    return this.workScheduleService.getUserSchedule(userId, query.weekStart);
  }

  @Put('admin/user/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  adminSaveSchedule(
    @User('id') adminId: string,
    @Param('userId') userId: string,
    @Body() body: AdminSaveScheduleDto,
  ) {
    return this.workScheduleService.adminSaveSchedule(adminId, userId, body);
  }

  @Patch('admin/:weekId/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  approve(@User('id') adminId: string, @Param('weekId') weekId: string) {
    return this.workScheduleService.approveSchedule(weekId, adminId);
  }

  @Patch('admin/:weekId/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  reject(
    @User('id') adminId: string,
    @Param('weekId') weekId: string,
    @Body() body: RejectScheduleDto,
  ) {
    return this.workScheduleService.rejectSchedule(weekId, adminId, body);
  }

  @Patch('admin/:weekId/reject-approved')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  rejectApproved(
    @User('id') adminId: string,
    @Param('weekId') weekId: string,
    @Body() body: RejectScheduleDto,
  ) {
    return this.workScheduleService.rejectApprovedSchedule(
      weekId,
      adminId,
      body,
    );
  }
}
