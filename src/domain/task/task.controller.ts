import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskService } from './task.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  getDashboard(@Query() query: TaskQueryDto) {
    return this.taskService.getDashboard(query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  createTask(@Body() body: CreateTaskDto, @User('id') userId: string) {
    return this.taskService.createTask(body, userId);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CASHIER', 'STAFF')
  updateTaskStatus(@Param('id') id: string, @Body() body: UpdateTaskStatusDto) {
    return this.taskService.updateTaskStatus(id, body);
  }
}
