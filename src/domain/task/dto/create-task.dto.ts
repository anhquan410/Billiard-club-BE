import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TaskPriority } from 'src/prisma';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsString()
  @IsNotEmpty()
  assigneeId: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
