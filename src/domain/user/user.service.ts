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

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Method to register a new user
  async register(data: CreateUserDto) {
    // Logic to create a new user in the database
    const { email, fullName, password, role } = data;
    const username = email.split('@')[0];
    const hashedPassword = await bcrypt.hash(password, 10);
    const isExistingUser = await this.databaseService.user.findUnique({
      where: { email },
    });
    if (isExistingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    const newUser = await this.databaseService.user.create({
      data: {
        email,
        fullName,
        username,
        password: hashedPassword,
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
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.databaseService.user.update({
      where: { id },
      data: { password: hashedNewPassword },
    });
    return { message: 'Đổi mật khẩu thành công' };
  }
}
