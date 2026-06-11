/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/prisma';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /**
   * Xác thực user bằng email hoặc số điện thoại
   */
  async validateUser(data: LoginUserDto): Promise<any> {
    const { emailOrPhone, password } = data;

    const user = await this.userService.findByEmailOrPhone(emailOrPhone);
    if (!user) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản với email hoặc số điện thoại này',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu không chính xác');
    }

    const { password: _, ...result } = user;
    return result;
  }

  /**
   * Tạo access token
   */
  async login(user: User) {
    const payload = { email: user.email, id: user.id, role: user.role };
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const hashedRefreshToken = bcrypt.hashSync(refreshToken, 10);

    // Lưu hashed refresh token vào database
    await this.userService.updateUser(user.id, {
      refreshToken: hashedRefreshToken,
    });

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Xác thực refresh token và cấp mới access token
   */
  async validateRefreshToken(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.userService.findById(decoded.id);

      if (!user || !user.refreshToken) {
        return false;
      }

      const isRefreshTokenValid = bcrypt.compareSync(
        refreshToken,
        user.refreshToken,
      );

      return isRefreshTokenValid ? user : false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Xóa refresh token khi logout
   */
  async logout(userId: string) {
    await this.userService.updateUser(userId, { refreshToken: '' });
  }
}
