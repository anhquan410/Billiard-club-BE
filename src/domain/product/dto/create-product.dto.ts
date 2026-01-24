import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum ProductCategory {
  FOOD = 'FOOD',
  BEVERAGE = 'BEVERAGE',
  EQUIPMENT = 'EQUIPMENT',
  OTHER = 'OTHER',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description: string;

  @IsEnum(ProductCategory)
  @IsNotEmpty()
  category: ProductCategory;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  costPrice: number;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsString()
  @IsOptional()
  imageUrl: string;
}
