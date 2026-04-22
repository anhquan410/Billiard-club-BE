import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class AdjustPointsDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsNumber()
  points!: number; // Có thể âm (trừ điểm) hoặc dương (cộng điểm)

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
