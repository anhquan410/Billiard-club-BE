import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { PayrollAdjustmentType } from 'src/prisma';

export class UpdatePayrollSettingsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dayShiftRate!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eveningShiftRate!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nightShiftRate!: number;
}

export class CreatePayrollAdjustmentDto {
  @IsUUID()
  userId!: string;

  @IsEnum(PayrollAdjustmentType)
  type!: PayrollAdjustmentType;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  reason!: string;

  @Matches(/^\d{4}-\d{2}$/, { message: 'month phải có định dạng YYYY-MM' })
  month!: string;
}

export class UpdatePayrollAdjustmentDto {
  @IsEnum(PayrollAdjustmentType)
  type!: PayrollAdjustmentType;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  reason!: string;
}

export class PayrollMonthQueryDto {
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;
}

export class PayrollAdjustmentQueryDto extends PayrollMonthQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
