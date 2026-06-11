import { IsEnum } from 'class-validator';
import { TaskStatus } from 'src/prisma';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
