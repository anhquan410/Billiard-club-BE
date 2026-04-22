import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsEmail,
} from 'class-validator';

export enum UserRole {
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

export class CreateUserDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(40, { message: 'Email không được vượt quá 40 ký tự' })
  email!: string;

  @IsNotEmpty({ message: 'Tên đầy đủ không được để trống' })
  @IsString()
  @MaxLength(30, { message: 'Tên đầy đủ không được vượt quá 30 ký tự' })
  fullName!: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString()
  password!: string;

  @IsEnum(UserRole, { message: 'Role không hợp lệ' })
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  @MaxLength(15, { message: 'Số điện thoại không được vượt quá 15 ký tự' })
  @Matches(/^(\+84|0)[0-9]{9,10}$/, {
    message: 'Số điện thoại phải bắt đầu bằng +84 hoặc 0 và có 10-11 chữ số',
  })
  phone?: string;
}
