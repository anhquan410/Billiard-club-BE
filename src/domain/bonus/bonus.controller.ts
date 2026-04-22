/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BonusService } from './bonus.service';
import { CalculateDiscountDto } from './dto/calculate-discount.dto';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('bonus')
export class BonusController {
  constructor(private readonly bonusService: BonusService) {}

  /**
   * Lấy thông tin điểm và hạng của user
   */
  @Get('profile/:userId')
  @UseGuards(RolesGuard)
  async getBonusProfile(@Param('userId') userId: string, @User() user: any) {
    // Chỉ admin hoặc chính user đó mới xem được
    if (user.role !== 'ADMIN' && user.id !== userId) {
      throw new ForbiddenException('Bạn chỉ được xem thông tin điểm của mình');
    }

    return await this.bonusService.getUserBonusInfo(userId);
  }

  /**
   * Lấy lịch sử giao dịch điểm
   */
  @Get('history/:userId')
  @UseGuards(RolesGuard)
  async getBonusHistory(
    @Param('userId') userId: string,
    @User() user: any,
    @Query('limit') limit?: string,
  ) {
    // Chỉ admin hoặc chính user đó mới xem được
    if (user.role !== 'ADMIN' && user.id !== userId) {
      throw new ForbiddenException('Bạn chỉ được xem lịch sử điểm của mình');
    }

    const limitNumber = limit ? parseInt(limit) : 50;
    return await this.bonusService.getBonusHistory(userId, limitNumber);
  }

  /**
   * Tính toán giảm giá trước khi thanh toán
   */
  @Post('calculate-discount')
  @Public() // Để frontend có thể gọi tự do để hiển thị preview
  async calculateDiscount(@Body() calculateDiscountDto: CalculateDiscountDto) {
    const { userId, totalAmount, usePoints, useTierDiscount } =
      calculateDiscountDto;

    return await this.bonusService.calculateOrderDiscount(
      userId,
      totalAmount,
      usePoints,
      useTierDiscount,
    );
  }

  /**
   * Admin điều chỉnh điểm thủ công
   */
  @Post('admin/adjust')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async adjustPoints(
    @Body() adjustPointsDto: AdjustPointsDto,
    @User() admin: any,
  ) {
    const { userId, points, reason } = adjustPointsDto;

    await this.bonusService.adjustPoints(userId, points, reason, admin.id);

    return {
      message: 'Điều chỉnh điểm thành công',
      adjustment: {
        userId,
        points,
        reason,
        adjustedBy: admin.fullName as string,
      },
    };
  }

  /**
   * Lấy thông tin hệ thống điểm (public)
   */
  @Get('system-info')
  @Public()
  getSystemInfo() {
    return {
      pointsPerVnd: 10000, // 10,000 VNĐ = 1 điểm
      vndPerPoint: 1000, // 1 điểm = 1,000 VNĐ
      membershipTiers: {
        BRONZE: { threshold: 500, discount: 5 },
        SILVER: { threshold: 1000, discount: 10 },
        GOLD: { threshold: 2000, discount: 15 },
        PLATINUM: { threshold: 5000, discount: 20 },
        DIAMOND: { threshold: 10000, discount: 25 },
      },
    };
  }
}
