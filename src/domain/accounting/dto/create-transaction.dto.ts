import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  AccountingCategory,
  AccountingTransactionType,
  PaymentMethod,
} from 'src/prisma';

export class CreateTransactionDto {
  @IsEnum(AccountingTransactionType)
  type: AccountingTransactionType;

  @IsEnum(AccountingCategory)
  category: AccountingCategory;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}
