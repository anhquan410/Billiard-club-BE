/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ProductCategory, ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStock?: number;

  @IsString()
  @IsOptional()
  unit?: string; // Default là "cái" ở Prisma, có thể bỏ qua

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus; // Default là "AVAILABLE"

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
