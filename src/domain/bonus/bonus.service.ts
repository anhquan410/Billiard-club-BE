import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MembershipTier, BonusTransactionType } from '@prisma/client';

@Injectable()
export class BonusService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ==================== CONSTANTS ====================

  private readonly POINTS_PER_VND = 10000; // 10,000 VNĐ = 1 điểm
  private readonly VND_PER_POINT = 1000; // 1 điểm = 1,000 VNĐ
  private readonly MAX_DISCOUNT_PERCENTAGE = 0.3; // Tối đa 30% hóa đơn

  private readonly TIER_THRESHOLDS = {
    [MembershipTier.BRONZE]: 500, // 5%
    [MembershipTier.SILVER]: 1000, // 10%
    [MembershipTier.GOLD]: 2000, // 15%
    [MembershipTier.PLATINUM]: 5000, // 20%
    [MembershipTier.DIAMOND]: 10000, // 25%
  };

  private readonly TIER_DISCOUNT_PERCENTAGES = {
    [MembershipTier.BRONZE]: 0.05, // 5%
    [MembershipTier.SILVER]: 0.1, // 10%
    [MembershipTier.GOLD]: 0.15, // 15%
    [MembershipTier.PLATINUM]: 0.2, // 20%
    [MembershipTier.DIAMOND]: 0.25, // 25%
  };

  // ==================== POINT CALCULATION ====================

  /**
   * Tính điểm từ số tiền
   */
  calculatePointsFromAmount(amount: number): number {
    return Math.floor(amount / this.POINTS_PER_VND);
  }

  /**
   * Tính số tiền giảm từ điểm
   */
  calculateDiscountFromPoints(points: number): number {
    return points * this.VND_PER_POINT;
  }

  /**
   * Tính số điểm tối đa có thể sử dụng (không vượt quá 30% hóa đơn)
   */
  calculateMaxUsablePoints(totalAmount: number, userPoints: number): number {
    const maxDiscountAmount = Math.floor(
      totalAmount * this.MAX_DISCOUNT_PERCENTAGE,
    );
    const maxPointsByAmount = Math.floor(
      maxDiscountAmount / this.VND_PER_POINT,
    );
    return Math.min(userPoints, maxPointsByAmount);
  }

  /**
   * Validate số điểm sử dụng không vượt quá giới hạn
   */
  validatePointUsage(pointsToUse: number, totalAmount: number): void {
    const maxDiscountAmount = totalAmount * this.MAX_DISCOUNT_PERCENTAGE;
    const requestedDiscountAmount = pointsToUse * this.VND_PER_POINT;

    if (requestedDiscountAmount > maxDiscountAmount) {
      throw new BadRequestException(
        `Không thể sử dụng quá ${this.MAX_DISCOUNT_PERCENTAGE * 100}% giá trị hóa đơn. ` +
          `Tối đa ${Math.floor(maxDiscountAmount / this.VND_PER_POINT)} điểm cho hóa đơn ${totalAmount.toLocaleString('vi-VN')} VNĐ`,
      );
    }
  }

  /**
   * Tính giảm giá theo hạng
   */
  calculateTierDiscount(tier: MembershipTier, amount: number): number {
    const percentage = this.TIER_DISCOUNT_PERCENTAGES[tier];
    return Math.floor(amount * percentage);
  }

  /**
   * Lấy % giảm giá theo hạng
   */
  getTierDiscountPercentage(tier: MembershipTier): number {
    return this.TIER_DISCOUNT_PERCENTAGES[tier] * 100;
  }

  /**
   * Xác định hạng dựa trên tổng điểm
   */
  private determineTier(totalPoints: number): MembershipTier {
    if (totalPoints >= this.TIER_THRESHOLDS[MembershipTier.DIAMOND]) {
      return MembershipTier.DIAMOND;
    } else if (totalPoints >= this.TIER_THRESHOLDS[MembershipTier.PLATINUM]) {
      return MembershipTier.PLATINUM;
    } else if (totalPoints >= this.TIER_THRESHOLDS[MembershipTier.GOLD]) {
      return MembershipTier.GOLD;
    } else if (totalPoints >= this.TIER_THRESHOLDS[MembershipTier.SILVER]) {
      return MembershipTier.SILVER;
    } else {
      return MembershipTier.BRONZE;
    }
  }

  // ==================== USER OPERATIONS ====================

  /**
   * Lấy thông tin điểm và hạng của user
   */
  async getUserBonusInfo(userId: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        bonusPoints: true,
        membershipTier: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      ...user,
      tierDiscountPercentage: this.getTierDiscountPercentage(
        user.membershipTier,
      ),
      nextTierThreshold: this.getNextTierThreshold(user.membershipTier),
      pointsToNextTier: this.getPointsToNextTier(
        user.bonusPoints,
        user.membershipTier,
      ),
    };
  }

  /**
   * Cập nhật hạng thành viên dựa trên tổng điểm
   */
  async updateUserTier(userId: string): Promise<MembershipTier> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { bonusPoints: true, membershipTier: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const newTier = this.determineTier(user.bonusPoints);

    if (newTier !== user.membershipTier) {
      await this.databaseService.user.update({
        where: { id: userId },
        data: { membershipTier: newTier },
      });
    }

    return newTier;
  }

  /**
   * Lấy ngưỡng điểm cho hạng tiếp theo
   */
  private getNextTierThreshold(currentTier: MembershipTier): number | null {
    switch (currentTier) {
      case MembershipTier.BRONZE:
        return this.TIER_THRESHOLDS[MembershipTier.SILVER];
      case MembershipTier.SILVER:
        return this.TIER_THRESHOLDS[MembershipTier.GOLD];
      case MembershipTier.GOLD:
        return this.TIER_THRESHOLDS[MembershipTier.PLATINUM];
      case MembershipTier.PLATINUM:
        return this.TIER_THRESHOLDS[MembershipTier.DIAMOND];
      case MembershipTier.DIAMOND:
        return null; // Đã đạt hạng cao nhất
      default:
        return null;
    }
  }

  /**
   * Tính số điểm cần thiết để lên hạng tiếp theo
   */
  private getPointsToNextTier(
    currentPoints: number,
    currentTier: MembershipTier,
  ): number | null {
    const nextThreshold = this.getNextTierThreshold(currentTier);
    if (!nextThreshold) {
      return null; // Đã đạt hạng cao nhất
    }
    return Math.max(0, nextThreshold - currentPoints);
  }

  // ==================== TRANSACTION OPERATIONS ====================

  /**
   * Tích điểm cho user từ thanh toán
   */
  async earnPoints(
    userId: string,
    orderId: string,
    finalAmount: number,
  ): Promise<void> {
    const pointsToEarn = this.calculatePointsFromAmount(finalAmount);

    if (pointsToEarn <= 0) {
      return; // Không tích điểm nếu số tiền quá nhỏ
    }

    // Cập nhật điểm cho user
    await this.databaseService.user.update({
      where: { id: userId },
      data: {
        bonusPoints: {
          increment: pointsToEarn,
        },
      },
    });

    // Tạo transaction history
    await this.databaseService.bonusTransaction.create({
      data: {
        userId,
        orderId,
        type: BonusTransactionType.EARNED,
        points: pointsToEarn,
        description: `Tích ${pointsToEarn} điểm từ hóa đơn ${finalAmount.toLocaleString('vi-VN')} VNĐ`,
      },
    });

    // Cập nhật hạng thành viên
    await this.updateUserTier(userId);
  }

  /**
   * Sử dụng điểm để giảm tiền
   */
  async redeemPoints(
    userId: string,
    orderId: string,
    pointsToUse: number,
    totalAmount?: number,
  ): Promise<number> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { bonusPoints: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (pointsToUse <= 0) {
      throw new BadRequestException('Số điểm phải lớn hơn 0');
    }

    if (user.bonusPoints < pointsToUse) {
      throw new BadRequestException('Không đủ điểm để sử dụng');
    }

    // Validate giới hạn 30% (nếu có totalAmount)
    if (totalAmount) {
      this.validatePointUsage(pointsToUse, totalAmount);
    }

    const discountAmount = this.calculateDiscountFromPoints(pointsToUse);

    // Trừ điểm từ user
    await this.databaseService.user.update({
      where: { id: userId },
      data: {
        bonusPoints: {
          decrement: pointsToUse,
        },
      },
    });

    // Tạo transaction history
    await this.databaseService.bonusTransaction.create({
      data: {
        userId,
        orderId,
        type: BonusTransactionType.REDEEMED,
        points: -pointsToUse,
        description: `Sử dụng ${pointsToUse} điểm để giảm ${discountAmount.toLocaleString('vi-VN')} VNĐ`,
      },
    });

    // Cập nhật hạng thành viên (có thể bị giảm hạng)
    await this.updateUserTier(userId);

    return discountAmount;
  }

  /**
   * Lấy lịch sử giao dịch điểm của user
   */
  async getBonusHistory(userId: string, limit: number = 50) {
    return await this.databaseService.bonusTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: {
          select: {
            orderNumber: true,
            total: true,
          },
        },
      },
    });
  }

  /**
   * Admin điều chỉnh điểm thủ công
   */
  async adjustPoints(
    userId: string,
    points: number,
    reason: string,
    adminId?: string,
  ): Promise<void> {
    // Cập nhật điểm cho user
    await this.databaseService.user.update({
      where: { id: userId },
      data: {
        bonusPoints: {
          increment: points,
        },
      },
    });

    // Tạo transaction history
    await this.databaseService.bonusTransaction.create({
      data: {
        userId,
        type: BonusTransactionType.ADJUSTED,
        points,
        description: `${adminId ? `Admin ${adminId}` : 'Hệ thống'} điều chỉnh: ${reason}`,
      },
    });

    // Cập nhật hạng thành viên
    await this.updateUserTier(userId);
  }

  // ==================== CALCULATION HELPERS ====================

  /**
   * Tính toán giảm giá tổng cộng cho đơn hàng
   */
  async calculateOrderDiscount(
    userId: string,
    originalAmount: number,
    usePoints?: number,
    useTierDiscount?: boolean,
  ): Promise<{
    pointsDiscount: number;
    tierDiscount: number;
    totalDiscount: number;
    finalAmount: number;
    canUsePoints: boolean;
    maxUsablePoints: number;
  }> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { bonusPoints: true, membershipTier: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    let pointsDiscount = 0;
    let tierDiscount = 0;

    // Tính giảm giá từ điểm (nếu sử dụng)
    if (usePoints && usePoints > 0) {
      if (user.bonusPoints < usePoints) {
        throw new BadRequestException('Không đủ điểm để sử dụng');
      }
      pointsDiscount = this.calculateDiscountFromPoints(usePoints);
    }

    // Tính giảm giá từ hạng (chỉ khi không dùng điểm)
    if (useTierDiscount && (!usePoints || usePoints === 0)) {
      tierDiscount = this.calculateTierDiscount(
        user.membershipTier,
        originalAmount,
      );
    }

    const totalDiscount = pointsDiscount + tierDiscount;
    const finalAmount = Math.max(0, originalAmount - totalDiscount);

    // Tính số điểm tối đa có thể dùng (giới hạn 30% + số điểm user có)
    const maxUsablePoints = this.calculateMaxUsablePoints(
      originalAmount,
      user.bonusPoints,
    );

    return {
      pointsDiscount,
      tierDiscount,
      totalDiscount,
      finalAmount,
      canUsePoints: user.bonusPoints > 0,
      maxUsablePoints,
    };
  }
}
