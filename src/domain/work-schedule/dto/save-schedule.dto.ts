/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ShiftType } from 'src/prisma';

export class ShiftRegistrationDto {
  @IsDateString()
  workDate!: string;

  @IsEnum(ShiftType)
  shiftType!: ShiftType;
}

export class SaveScheduleDto {
  @IsDateString()
  weekStart!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftRegistrationDto)
  shifts!: ShiftRegistrationDto[];
}

export class AdminSaveScheduleDto extends SaveScheduleDto {
  @IsOptional()
  approve?: boolean;
}

export class RejectScheduleDto {
  @IsString()
  rejectReason!: string;
}

export class ScheduleQueryDto {
  @IsDateString()
  weekStart!: string;
}
