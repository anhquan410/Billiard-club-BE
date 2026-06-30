/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollAdjustmentType,
  ShiftType,
  UserRole,
  UserStatus,
  WorkScheduleStatus,
} from 'src/prisma';
import { DatabaseService } from 'src/database/database.service';
import { formatDateOnly, getMonthRange } from 'src/common/utils/vn-timezone';
import {
  CreatePayrollAdjustmentDto,
  UpdatePayrollSettingsDto,
} from './dto/payroll.dto';

const SHIFT_LABELS: Record<ShiftType, string> = {
  DAY: 'Ca ngày',
  EVENING: 'Ca tối',
  NIGHT: 'Ca đêm',
};

const REGISTER_ROLES: UserRole[] = [UserRole.CASHIER, UserRole.STAFF];

@Injectable()
export class PayrollService {
  constructor(private readonly db: DatabaseService) {}

  async getSettings() {
    let settings = await this.db.payrollSettings.findUnique({
      where: { id: 'default' },
    });
    if (!settings) {
      settings = await this.db.payrollSettings.create({
        data: { id: 'default' },
      });
    }
    return {
      ...settings,
      dayShiftRate: Number(settings.dayShiftRate),
      eveningShiftRate: Number(settings.eveningShiftRate),
      nightShiftRate: Number(settings.nightShiftRate),
    };
  }

  async updateSettings(dto: UpdatePayrollSettingsDto) {
    const settings = await this.db.payrollSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
    return {
      ...settings,
      dayShiftRate: Number(settings.dayShiftRate),
      eveningShiftRate: Number(settings.eveningShiftRate),
      nightShiftRate: Number(settings.nightShiftRate),
    };
  }

  async getMyPayroll(userId: string, month: string) {
    await this.assertPayrollUser(userId);
    return this.buildPayrollSummary(userId, month);
  }

  async getUserPayroll(userId: string, month: string) {
    await this.assertPayrollUser(userId);
    return this.buildPayrollSummary(userId, month);
  }

  async getAdminSummary(month: string) {
    const employees = await this.db.user.findMany({
      where: {
        role: { in: REGISTER_ROLES },
        status: UserStatus.ACTIVE,
      },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });

    const summaries = await Promise.all(
      employees.map((emp) => this.buildPayrollSummary(emp.id, month)),
    );

    const totals = summaries.reduce(
      (acc, s) => ({
        totalShifts: acc.totalShifts + s.totalShifts,
        shiftSalary: acc.shiftSalary + s.shiftSalary,
        bonuses: acc.bonuses + s.bonuses,
        penalties: acc.penalties + s.penalties,
        netSalary: acc.netSalary + s.netSalary,
      }),
      {
        totalShifts: 0,
        shiftSalary: 0,
        bonuses: 0,
        penalties: 0,
        netSalary: 0,
      },
    );

    return { month, totals, employees: summaries };
  }

  async createAdjustment(adminId: string, dto: CreatePayrollAdjustmentDto) {
    await this.assertPayrollUser(dto.userId);

    const periodMonth = getMonthRange(dto.month).start;

    const adjustment = await this.db.payrollAdjustment.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
        periodMonth,
        createdById: adminId,
      },
      include: {
        user: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    return this.mapAdjustment(adjustment);
  }

  async getAdjustments(month: string, userId?: string) {
    const { start, end } = getMonthRange(month);
    const adjustments = await this.db.payrollAdjustment.findMany({
      where: {
        periodMonth: { gte: start, lte: end },
        ...(userId ? { userId } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return adjustments.map((a) => this.mapAdjustment(a));
  }

  private async buildPayrollSummary(userId: string, month: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, role: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');

    const settings = await this.getSettings();
    const { start, end } = getMonthRange(month);

    const approvedShifts = await this.db.workShiftRegistration.findMany({
      where: {
        workDate: { gte: start, lte: end },
        week: {
          userId,
          status: WorkScheduleStatus.APPROVED,
        },
      },
      include: {
        week: { select: { weekStart: true, status: true } },
      },
      orderBy: [{ workDate: 'asc' }, { shiftType: 'asc' }],
    });

    const rateMap: Record<ShiftType, number> = {
      DAY: settings.dayShiftRate,
      EVENING: settings.eveningShiftRate,
      NIGHT: settings.nightShiftRate,
    };

    const breakdown: Record<
      ShiftType,
      { count: number; rate: number; amount: number }
    > = {
      DAY: {
        count: 0,
        rate: rateMap.DAY,
        amount: 0,
      },
      EVENING: {
        count: 0,
        rate: rateMap.EVENING,
        amount: 0,
      },
      NIGHT: {
        count: 0,
        rate: rateMap.NIGHT,
        amount: 0,
      },
    };

    for (const shift of approvedShifts) {
      breakdown[shift.shiftType].count += 1;
      breakdown[shift.shiftType].amount += rateMap[shift.shiftType];
    }

    const shiftSalary = Object.values(breakdown).reduce(
      (sum, b) => sum + b.amount,
      0,
    );

    const adjustments = await this.db.payrollAdjustment.findMany({
      where: {
        userId,
        periodMonth: { gte: start, lte: end },
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bonuses = adjustments
      .filter((a) => a.type === PayrollAdjustmentType.BONUS)
      .reduce((sum, a) => sum + Number(a.amount), 0);

    const penalties = adjustments
      .filter((a) => a.type === PayrollAdjustmentType.PENALTY)
      .reduce((sum, a) => sum + Number(a.amount), 0);

    return {
      month,
      user,
      totalShifts: approvedShifts.length,
      shiftBreakdown: Object.entries(breakdown).map(([type, data]) => ({
        shiftType: type as ShiftType,
        label: SHIFT_LABELS[type as ShiftType],
        ...data,
      })),
      shiftSalary,
      bonuses,
      penalties,
      netSalary: shiftSalary + bonuses - penalties,
      approvedShifts: approvedShifts.map((s) => ({
        id: s.id,
        workDate: formatDateOnly(s.workDate),
        shiftType: s.shiftType,
        label: SHIFT_LABELS[s.shiftType],
        rate: rateMap[s.shiftType],
        weekStart: formatDateOnly(s.week.weekStart),
      })),
      adjustments: adjustments.map((a) => this.mapAdjustment(a)),
    };
  }

  private mapAdjustment(adjustment: {
    id: string;
    userId: string;
    type: PayrollAdjustmentType;
    amount: { toString(): string } | number;
    reason: string;
    periodMonth: Date;
    createdAt: Date;
    user?: { id: string; fullName: string } | null;
    createdBy: { id: string; fullName: string };
  }) {
    return {
      id: adjustment.id,
      userId: adjustment.userId,
      user: adjustment.user ?? null,
      type: adjustment.type,
      amount: Number(adjustment.amount),
      reason: adjustment.reason,
      month: formatDateOnly(adjustment.periodMonth).slice(0, 7),
      createdAt: adjustment.createdAt,
      createdBy: adjustment.createdBy,
    };
  }

  private async assertPayrollUser(userId: string) {
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        role: { in: REGISTER_ROLES },
        status: UserStatus.ACTIVE,
      },
    });
    if (!user) {
      throw new BadRequestException('Chỉ áp dụng cho nhân viên/thu ngân');
    }
  }

  assertCanViewPayroll(
    requester: { id: string; role: string },
    targetUserId: string,
  ) {
    if (requester.role === UserRole.ADMIN) return;
    if (requester.id === targetUserId) return;
    throw new ForbiddenException('Bạn chỉ được xem lương của mình');
  }
}
