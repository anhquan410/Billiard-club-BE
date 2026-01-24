import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum UserRole {
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  fullName: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
