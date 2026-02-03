/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { Delete } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../auth/decorators/user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserPaginationDto } from './dto/user-pagiation.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Register a new user
  @Public()
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const newUser = await this.userService.register(createUserDto);
    return newUser;
  }

  // Get all users (admin only)
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN được truy cập
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  // Paginate users (admin only)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN được truy cập
  async findUserPagination(@Query() query: UserPaginationDto) {
    return this.userService.paginate(query);
  }

  // Get user by ID (admin and Login-user)
  @Get(':id')
  @UseGuards(RolesGuard)
  async getUserById(@Param('id') id: string, @User() user) {
    // console.log(user);
    const userData = await this.userService.findById(id);
    if (user.role === 'ADMIN') {
      return userData; // Admin: Có thể xem thông tin của bất kỳ user nào
    }
    // User thường: Chỉ được xem thông tin của chính mình
    if (user.id !== id) {
      throw new ForbiddenException('Bạn chỉ được xem thông tin của mình');
    }
    return userData;
  }

  // Update user info
  // (Both ADMIN and regular USER can update, but with different permissions)
  @Patch(':id')
  @UseGuards(RolesGuard) // Auth required
  updateUser(
    @Param('id') targetId: string,
    @Body() updateUserDto: UpdateUserDto,
    @User() user,
  ) {
    if (user.role === 'ADMIN') {
      // Admin: Có thể update mọi thông tin, kể cả role
      return this.userService.updateUser(targetId, updateUserDto);
    }

    // User thường: Phải là chính mình mới được update
    if (user.id !== targetId) {
      throw new ForbiddenException('Bạn chỉ được sửa thông tin của mình');
    }
    // Không cho phép user thường sửa field role
    const { role, ...safeDto } = updateUserDto;

    return this.userService.updateUser(targetId, safeDto); // Chỉ truyền các field hợp lệ cho user thường
  }

  // Delete user (admin only)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }

  // Change password (both admin and user themselves)
  @Patch(':id/change-password')
  @UseGuards(RolesGuard)
  async changePassword(
    @Param('id') targetId: string,
    @Body() data: ChangePasswordDto,
    @User() user,
  ) {
    if (user.role === 'ADMIN') {
      // Admin: Có thể đổi password cho bất kỳ user nào
      return this.userService.changePassword(targetId, data);
    }

    // User thường: Phải là chính mình mới được đổi password
    if (user.id !== targetId) {
      throw new ForbiddenException('Bạn chỉ được đổi mật khẩu của mình');
    }

    return this.userService.changePassword(targetId, data);
  }
}
