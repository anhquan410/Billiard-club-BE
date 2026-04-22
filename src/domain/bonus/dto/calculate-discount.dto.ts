import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CalculateDiscountDto {
  @IsString()
  userId!: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  totalAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value ? Number(value) : undefined))
  usePoints?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  useTierDiscount?: boolean = true;
}
