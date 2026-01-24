import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
