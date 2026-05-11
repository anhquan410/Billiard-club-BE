import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';
export enum UserRole {
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsString()
  @IsOptional()
  refreshToken?: string;
}
