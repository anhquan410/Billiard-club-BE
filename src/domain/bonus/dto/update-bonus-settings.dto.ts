import { IsInt, Max, Min } from 'class-validator';

export class UpdateBonusSettingsDto {
  @IsInt()
  @Min(1000)
  pointsPerVnd!: number;

  @IsInt()
  @Min(100)
  vndPerPoint!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  maxDiscountPercent!: number;

  @IsInt()
  @Min(0)
  silverThreshold!: number;

  @IsInt()
  @Min(0)
  goldThreshold!: number;

  @IsInt()
  @Min(0)
  platinumThreshold!: number;

  @IsInt()
  @Min(0)
  diamondThreshold!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  bronzeDiscount!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  silverDiscount!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  goldDiscount!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  platinumDiscount!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  diamondDiscount!: number;
}
