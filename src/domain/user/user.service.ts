import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserPaginationDto } from './dto/user-pagiation.dto';
import { AuthUtils } from '../auth/utils/auth.utils';

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Method to register a new user
  async register(data: CreateUserDto) {
    // Logic to create a new user in the database
    const { email, fullName, password, role, phone } = data;
    const username = email.split('@')[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    // Chuẩn hóa số điện thoại nếu có
    const normalizedPhone = phone ? AuthUtils.normalizePhone(phone) : null;

    // Kiểm tra user đã tồn tại
    const isExistingUser = await this.databaseService.user.findFirst({
      where: {
        OR: [
          { email },
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    if (isExistingUser) {
      if (isExistingUser.email === email) {
        throw new BadRequestException('Email đã được sử dụng');
      }
      if (normalizedPhone && isExistingUser.phone === normalizedPhone) {
        throw new BadRequestException('Số điện thoại đã được sử dụng');
      }
    }

    const newUser = await this.databaseService.user.create({
      data: {
        email,
        fullName,
        username,
        password: hashedPassword,
        phone: normalizedPhone,
        role, // Thêm role nếu có
      },
    });
    return newUser;
  }

  // Find user by email
  async findOne(email: string) {
    const user = await this.databaseService.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Find user by email or phone for login
  async findByEmailOrPhone(emailOrPhone: string) {
    const inputType = AuthUtils.getInputType(emailOrPhone);
    const normalizedInput =
      inputType === 'phone'
        ? AuthUtils.normalizePhone(emailOrPhone)
        : emailOrPhone;

    const user = await this.databaseService.user.findFirst({
      where:
        inputType === 'email'
          ? { email: normalizedInput }
          : { phone: normalizedInput },
    });

    return user;
  }

  // Find user by ID
  async findById(id: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Get all users (for admin)
  async getAllUsers() {
    return await this.databaseService.user.findMany();
  }

  // Paginate users (for admin)
  async paginate(query: UserPaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [items, total] = await Promise.all([
      this.databaseService.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }, // pagination stable
      }),
      this.databaseService.user.count(),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Update user info
  async updateUser(id: string, data: UpdateUserDto) {
    return await this.databaseService.user.update({
      where: { id },
      data: data,
    });
  }

  // Delete user
  async deleteUser(id: string) {
    const deleteUser = await this.databaseService.user.delete({
      where: { id },
    });
    return `User ${deleteUser.fullName} has been deleted.`;
  }

  // Change user password
  async changePassword(id: string, data: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmNewPassword } = data;
    const user = await this.databaseService.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Mật khẩu cũ không đúng');
    }
    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Mật khẩu mới không khớp');
    }
    const isChanged = await bcrypt.compare(newPassword, user.password);
    if (isChanged) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    }
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.databaseService.user.update({
      where: { id },
      data: { password: hashedNewPassword },
    });
    return { message: 'Đổi mật khẩu thành công' };
  }
}
