import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DebtType } from 'src/prisma';

export class CreateDebtDto {
  @IsEnum(DebtType)
  type: DebtType;

  @IsString()
  @IsNotEmpty()
  partnerName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  note?: string;
}
