import { IsEnum, IsOptional } from 'class-validator';
import { TaskStatus } from 'src/prisma';

export class TaskQueryDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
