import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, IsString, IsEnum } from 'class-validator';
import { MovementType } from '@prisma/client';

export class StockMovementPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType; // IMPORT, EXPORT, ADJUST

  @IsOptional()
  @IsString()
  productId?: string; // Lọc theo sản phẩm

  @IsOptional()
  @IsString()
  search?: string; // Tìm theo tên sản phẩm hoặc lý do
}
