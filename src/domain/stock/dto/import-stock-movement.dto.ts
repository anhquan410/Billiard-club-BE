import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportStockMovementDto {
  @IsNotEmpty({ message: 'Product ID không được để trống' })
  @IsString()
  productId: string;

  @IsNotEmpty({ message: 'Số lượng không được để trống' })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity: number;

  @IsNotEmpty({ message: 'Giá nhập không được để trống' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Giá nhập phải lớn hơn hoặc bằng 0' })
  unitPrice: number;

  @IsOptional()
  @IsString()
  reason?: string; // Lý do nhập hàng
}
