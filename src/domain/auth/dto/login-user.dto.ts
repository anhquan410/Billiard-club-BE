import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class LoginUserDto {
  @IsNotEmpty({ message: 'Email hoặc số điện thoại không được để trống' })
  @IsString()
  @MaxLength(40, {
    message: 'Email hoặc số điện thoại không được vượt quá 40 ký tự',
  })
  @Matches(
    /^(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(\+84|0)[0-9]{9,10})$/,
    { message: 'Email hoặc số điện thoại không hợp lệ' },
  )
  emailOrPhone!: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString()
  password!: string;
}
