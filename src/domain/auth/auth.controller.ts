/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { Public } from './decorators/public.decorator';
import { User } from './decorators/user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Login user
  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('login')
  async login(@Body() data: LoginUserDto) {
    const user = await this.authService.validateUser(data);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  // Get profile of logged-in user
  @Get('profile')
  getProfile(@User() user) {
    // req.user đã được giải mã từ JWT token
    return user;
  }

  // Logout user
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout() {
    // Với JWT, chỉ cần client xóa token. Server trả về thông báo thành công.
    return { message: 'Logout successful' };
  }
}
