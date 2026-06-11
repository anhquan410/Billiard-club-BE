import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from 'src/prisma';

export class BookingQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
