import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  ValidateNested,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class OrderItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  price!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  sessionId?: string; // ID session bàn (nếu có)

  @IsOptional()
  @IsString()
  customerId?: string; // ID khách hàng (để tích điểm)

  @IsString()
  createdBy!: string; // ID nhân viên tạo hóa đơn

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  subtotal!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value ? Number(value) : 0))
  discount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value ? Number(value) : 0))
  tax?: number = 0;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;

  // ========== BONUS SYSTEM FIELDS ==========

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value ? Number(value) : undefined))
  bonusPointsToUse?: number; // Số điểm muốn sử dụng

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  useTierDiscount?: boolean = true; // Sử dụng giảm giá theo hạng (chỉ khi không dùng điểm)
}
