import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { AccountingTransactionType } from 'src/prisma';

export class AccountingQueryDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsOptional()
  @IsEnum(AccountingTransactionType)
  type?: AccountingTransactionType;
}
