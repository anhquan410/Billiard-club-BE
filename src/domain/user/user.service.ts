/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { Prisma, UserRole, UserStatus } from 'src/prisma';

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
        phone: normalizedPhone || '', // Provide empty string if null
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

  // Danh sách nhân viên để giao việc (không gồm khách hàng)
  async listStaffForAssignment() {
    return this.databaseService.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.CASHIER, UserRole.STAFF] },
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        fullName: true,
        role: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  // Tìm khách hàng (cho thu ngân gán vào phiên chơi)
  async searchCustomers(search?: string) {
    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    };

    const keyword = search?.trim();
    if (keyword) {
      where.OR = [
        { fullName: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    return this.databaseService.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        bonusPoints: true,
        membershipTier: true,
      },
      orderBy: { fullName: 'asc' },
      take: 30,
    });
  }

  // Get all users (for admin)
  async getAllUsers() {
    return await this.databaseService.user.findMany({
      where: { status: UserStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Paginate users (for admin)
  async paginate(query: UserPaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [items, total] = await Promise.all([
      this.databaseService.user.findMany({
        where: { status: UserStatus.ACTIVE },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }, // pagination stable
      }),
      this.databaseService.user.count({ where: { status: UserStatus.ACTIVE } }),
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

  // Delete user (hard delete when possible, otherwise deactivate)
  async deleteUser(id: string) {
    const user = await this.findById(id);

    const hasBlockingHistory = await this.databaseService.$transaction(
      async (tx) => {
        await tx.notification.deleteMany({ where: { userId: id } });
        await tx.bonusTransaction.deleteMany({ where: { userId: id } });

        await tx.tableSession.updateMany({
          where: { cashierId: id },
          data: { cashierId: null },
        });
        await tx.tableSession.updateMany({
          where: { staffId: id },
          data: { staffId: null },
        });
        await tx.tableSession.updateMany({
          where: { customerId: id },
          data: { customerId: null },
        });

        await tx.order.updateMany({
          where: { customerId: id },
          data: { customerId: null },
        });

        await tx.tableBooking.updateMany({
          where: { customerId: id },
          data: { customerId: null },
        });
        await tx.tableBooking.updateMany({
          where: { confirmedById: id },
          data: { confirmedById: null },
        });

        await tx.staffTask.deleteMany({
          where: { OR: [{ assigneeId: id }, { createdById: id }] },
        });

        const [stockMovements, accountingRecords] = await Promise.all([
          tx.stockMovement.count({ where: { createdBy: id } }),
          tx.accountingTransaction.count({ where: { createdById: id } }),
        ]);

        return stockMovements > 0 || accountingRecords > 0;
      },
    );

    if (hasBlockingHistory) {
      await this.databaseService.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
      });
      return {
        message: `Đã vô hiệu hóa tài khoản ${user.fullName} (còn dữ liệu kho/kế toán, không xóa vĩnh viễn được).`,
        softDeleted: true,
      };
    }

    await this.databaseService.user.delete({ where: { id } });
    return {
      message: `Đã xóa tài khoản ${user.fullName}.`,
      softDeleted: false,
    };
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
