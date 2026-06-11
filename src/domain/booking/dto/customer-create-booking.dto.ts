import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CustomerCreateBookingDto {
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsDateString()
  bookingDate: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsInt()
  @Min(1)
  guestCount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
