import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MembershipTier, BonusTransactionType } from 'src/prisma';
import { UpdateBonusSettingsDto } from './dto/update-bonus-settings.dto';

type BonusConfig = {
  pointsPerVnd: number;
  vndPerPoint: number;
  maxDiscountPercent: number;
  thresholds: Record<MembershipTier, number>;
  discounts: Record<MembershipTier, number>;
};

@Injectable()
export class BonusService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async getConfig(): Promise<BonusConfig> {
    let settings = await this.databaseService.bonusSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await this.databaseService.bonusSettings.create({
        data: { id: 'default' },
      });
    }

    return {
      pointsPerVnd: settings.pointsPerVnd,
      vndPerPoint: settings.vndPerPoint,
      maxDiscountPercent: settings.maxDiscountPercent,
      thresholds: {
        [MembershipTier.BRONZE]: 0,
        [MembershipTier.SILVER]: settings.silverThreshold,
        [MembershipTier.GOLD]: settings.goldThreshold,
        [MembershipTier.PLATINUM]: settings.platinumThreshold,
        [MembershipTier.DIAMOND]: settings.diamondThreshold,
      },
      discounts: {
        [MembershipTier.BRONZE]: settings.bronzeDiscount / 100,
        [MembershipTier.SILVER]: settings.silverDiscount / 100,
        [MembershipTier.GOLD]: settings.goldDiscount / 100,
        [MembershipTier.PLATINUM]: settings.platinumDiscount / 100,
        [MembershipTier.DIAMOND]: settings.diamondDiscount / 100,
      },
    };
  }

  async getSettings() {
    const settings = await this.databaseService.bonusSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      return this.databaseService.bonusSettings.create({
        data: { id: 'default' },
      });
    }

    return settings;
  }

  async updateSettings(dto: UpdateBonusSettingsDto) {
    if (
      dto.silverThreshold >= dto.goldThreshold ||
      dto.goldThreshold >= dto.platinumThreshold ||
      dto.platinumThreshold >= dto.diamondThreshold
    ) {
      throw new BadRequestException(
        'Ngưỡng hạng phải tăng dần: Bạc < Vàng < Bạch kim < Kim cương',
      );
    }

    return this.databaseService.bonusSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
  }

  async getSystemInfo() {
    const settings = await this.getSettings();
    return {
      pointsPerVnd: settings.pointsPerVnd,
      vndPerPoint: settings.vndPerPoint,
      maxDiscountPercent: settings.maxDiscountPercent,
      membershipTiers: {
        BRONZE: { threshold: 0, discount: settings.bronzeDiscount },
        SILVER: { threshold: settings.silverThreshold, discount: settings.silverDiscount },
        GOLD: { threshold: settings.goldThreshold, discount: settings.goldDiscount },
        PLATINUM: {
          threshold: settings.platinumThreshold,
          discount: settings.platinumDiscount,
        },
        DIAMOND: {
          threshold: settings.diamondThreshold,
          discount: settings.diamondDiscount,
        },
      },
    };
  }

  async calculatePointsFromAmount(amount: number): Promise<number> {
    const config = await this.getConfig();
    return Math.floor(amount / config.pointsPerVnd);
  }

  async calculateDiscountFromPoints(points: number): Promise<number> {
    const config = await this.getConfig();
    return points * config.vndPerPoint;
  }

  async calculateMaxUsablePoints(
    totalAmount: number,
    userPoints: number,
  ): Promise<number> {
    const config = await this.getConfig();
    const maxDiscountAmount = Math.floor(
      totalAmount * (config.maxDiscountPercent / 100),
    );
    const maxPointsByAmount = Math.floor(
      maxDiscountAmount / config.vndPerPoint,
    );
    return Math.min(userPoints, maxPointsByAmount);
  }

  async validatePointUsage(
    pointsToUse: number,
    totalAmount: number,
  ): Promise<void> {
    const config = await this.getConfig();
    const maxDiscountAmount =
      totalAmount * (config.maxDiscountPercent / 100);
    const requestedDiscountAmount = pointsToUse * config.vndPerPoint;

    if (requestedDiscountAmount > maxDiscountAmount) {
      throw new BadRequestException(
        `Không thể sử dụng quá ${config.maxDiscountPercent}% giá trị hóa đơn. ` +
          `Tối đa ${Math.floor(maxDiscountAmount / config.vndPerPoint)} điểm cho hóa đơn ${totalAmount.toLocaleString('vi-VN')} VNĐ`,
      );
    }
  }

  async calculateTierDiscount(
    tier: MembershipTier,
    amount: number,
  ): Promise<number> {
    const config = await this.getConfig();
    return Math.floor(amount * config.discounts[tier]);
  }

  async getTierDiscountPercentage(tier: MembershipTier): Promise<number> {
    const config = await this.getConfig();
    return config.discounts[tier] * 100;
  }

  private determineTier(
    totalPoints: number,
    thresholds: Record<MembershipTier, number>,
  ): MembershipTier {
    if (totalPoints >= thresholds[MembershipTier.DIAMOND]) {
      return MembershipTier.DIAMOND;
    }
    if (totalPoints >= thresholds[MembershipTier.PLATINUM]) {
      return MembershipTier.PLATINUM;
    }
    if (totalPoints >= thresholds[MembershipTier.GOLD]) {
      return MembershipTier.GOLD;
    }
    if (totalPoints >= thresholds[MembershipTier.SILVER]) {
      return MembershipTier.SILVER;
    }
    return MembershipTier.BRONZE;
  }

  async getUserBonusInfo(userId: string) {
    const config = await this.getConfig();
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
      tierDiscountPercentage: config.discounts[user.membershipTier] * 100,
      nextTierThreshold: this.getNextTierThreshold(
        user.membershipTier,
        config.thresholds,
      ),
      pointsToNextTier: this.getPointsToNextTier(
        user.bonusPoints,
        user.membershipTier,
        config.thresholds,
      ),
    };
  }

  async updateUserTier(userId: string): Promise<MembershipTier> {
    const config = await this.getConfig();
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { bonusPoints: true, membershipTier: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const newTier = this.determineTier(user.bonusPoints, config.thresholds);

    if (newTier !== user.membershipTier) {
      await this.databaseService.user.update({
        where: { id: userId },
        data: { membershipTier: newTier },
      });
    }

    return newTier;
  }

  private getNextTierThreshold(
    currentTier: MembershipTier,
    thresholds: Record<MembershipTier, number>,
  ): number | null {
    switch (currentTier) {
      case MembershipTier.BRONZE:
        return thresholds[MembershipTier.SILVER];
      case MembershipTier.SILVER:
        return thresholds[MembershipTier.GOLD];
      case MembershipTier.GOLD:
        return thresholds[MembershipTier.PLATINUM];
      case MembershipTier.PLATINUM:
        return thresholds[MembershipTier.DIAMOND];
      case MembershipTier.DIAMOND:
        return null;
      default:
        return null;
    }
  }

  private getPointsToNextTier(
    currentPoints: number,
    currentTier: MembershipTier,
    thresholds: Record<MembershipTier, number>,
  ): number | null {
    const nextThreshold = this.getNextTierThreshold(currentTier, thresholds);
    if (!nextThreshold) return null;
    return Math.max(0, nextThreshold - currentPoints);
  }

  async earnPoints(
    userId: string,
    orderId: string,
    finalAmount: number,
  ): Promise<number> {
    const pointsToEarn = await this.calculatePointsFromAmount(finalAmount);
    if (pointsToEarn <= 0) return 0;

    await this.databaseService.user.update({
      where: { id: userId },
      data: { bonusPoints: { increment: pointsToEarn } },
    });

    await this.databaseService.bonusTransaction.create({
      data: {
        userId,
        orderId,
        type: BonusTransactionType.EARNED,
        points: pointsToEarn,
        description: `Tích ${pointsToEarn} điểm từ hóa đơn ${finalAmount.toLocaleString('vi-VN')} VNĐ`,
      },
    });

    await this.updateUserTier(userId);
    return pointsToEarn;
  }

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
    if (totalAmount) {
      await this.validatePointUsage(pointsToUse, totalAmount);
    }

    const discountAmount = await this.calculateDiscountFromPoints(pointsToUse);

    await this.databaseService.user.update({
      where: { id: userId },
      data: { bonusPoints: { decrement: pointsToUse } },
    });

    await this.databaseService.bonusTransaction.create({
      data: {
        userId,
        orderId,
        type: BonusTransactionType.REDEEMED,
        points: -pointsToUse,
        description: `Sử dụng ${pointsToUse} điểm để giảm ${discountAmount.toLocaleString('vi-VN')} VNĐ`,
      },
    });

    await this.updateUserTier(userId);
    return discountAmount;
  }

  async getBonusHistory(userId: string, limit: number = 50) {
    return this.databaseService.bonusTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: {
          select: { orderNumber: true, total: true },
        },
      },
    });
  }

  async adjustPoints(
    userId: string,
    points: number,
    reason: string,
    adminName?: string,
  ): Promise<void> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const nextPoints = user.bonusPoints + points;
    if (nextPoints < 0) {
      throw new BadRequestException('Số điểm sau điều chỉnh không được âm');
    }

    await this.databaseService.user.update({
      where: { id: userId },
      data: { bonusPoints: { increment: points } },
    });

    await this.databaseService.bonusTransaction.create({
      data: {
        userId,
        type: BonusTransactionType.ADJUSTED,
        points,
        description: `${adminName ? `Admin ${adminName}` : 'Admin'} điều chỉnh: ${reason}`,
      },
    });

    await this.updateUserTier(userId);
  }

  async calculateOrderDiscount(
    userId: string,
    originalAmount: number,
    usePoints?: number,
    useTierDiscount?: boolean,
  ) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { bonusPoints: true, membershipTier: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    let pointsDiscount = 0;
    let tierDiscount = 0;

    if (usePoints && usePoints > 0) {
      if (user.bonusPoints < usePoints) {
        throw new BadRequestException('Không đủ điểm để sử dụng');
      }
      pointsDiscount = await this.calculateDiscountFromPoints(usePoints);
    }

    if (useTierDiscount && (!usePoints || usePoints === 0)) {
      tierDiscount = await this.calculateTierDiscount(
        user.membershipTier,
        originalAmount,
      );
    }

    const totalDiscount = pointsDiscount + tierDiscount;
    const finalAmount = Math.max(0, originalAmount - totalDiscount);
    const maxUsablePoints = await this.calculateMaxUsablePoints(
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
