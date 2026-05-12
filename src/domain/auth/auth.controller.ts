/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
    // req.user is decoded from JWT token
    return user;
  }

  // Logout user
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@User() user) {
    // Xóa refreshToken trong DB khi logout
    await this.authService.logout(user.id);
    return { message: 'Logout successful' };
  }

  // Refresh token
  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('refresh-token')
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    // Logic để xác thực refresh token và cấp mới access token
    const user = await this.authService.validateRefreshToken(refreshToken);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Nếu valid, trả về access token mới
    return this.authService.login(user);
  }
}
