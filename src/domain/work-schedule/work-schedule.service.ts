/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
  ShiftType,
  UserRole,
  UserStatus,
  WorkScheduleStatus,
} from 'src/prisma';
import { DatabaseService } from 'src/database/database.service';
import {
  formatDateOnly,
  getRegistrationWeekStart,
  getWeekDates,
  isRegistrationOpen,
  parseDateOnly,
} from 'src/common/utils/vn-timezone';
import {
  AdminSaveScheduleDto,
  RejectScheduleDto,
  SaveScheduleDto,
  ShiftRegistrationDto,
} from './dto/save-schedule.dto';

const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.CASHIER,
  UserRole.STAFF,
];
const REGISTER_ROLES: UserRole[] = [UserRole.CASHIER, UserRole.STAFF];

const SHIFT_TYPES = [
  'DAY',
  'EVENING',
  'NIGHT',
] as const satisfies readonly ShiftType[];

const SHIFT_LABELS: Record<ShiftType, string> = {
  DAY: 'Ca ngày (09:00-17:00)',
  EVENING: 'Ca tối (17:00-01:00)',
  NIGHT: 'Ca đêm (01:00-09:00)',
};

@Injectable()
export class WorkScheduleService {
  constructor(private readonly db: DatabaseService) {}

  getRegistrationWindow() {
    const open = isRegistrationOpen();
    const weekStart = getRegistrationWeekStart();
    return {
      isOpen: open,
      weekStart: formatDateOnly(weekStart),
      message: open
        ? `Đang mở đăng ký lịch cho tuần bắt đầu ${formatDateOnly(weekStart)}`
        : 'Chỉ được đăng ký lịch vào Chủ nhật cho tuần tới',
      shiftTypes: SHIFT_TYPES.map((type) => ({
        type,
        label: SHIFT_LABELS[type],
      })),
    };
  }

  async getMySchedule(userId: string, weekStartStr: string) {
    const weekStart = parseDateOnly(weekStartStr);
    const week = await this.db.workScheduleWeek.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      include: this.weekInclude(),
    });

    if (!week) {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, role: true },
      });
      return {
        id: '',
        userId,
        weekStart: weekStartStr,
        status: WorkScheduleStatus.DRAFT,
        submittedAt: null,
        reviewedAt: null,
        rejectReason: null,
        user: user ?? null,
        reviewer: null,
        shifts: [],
        weekDates: getWeekDates(weekStart).map(formatDateOnly),
      };
    }

    return this.mapWeek(week);
  }

  async saveMySchedule(userId: string, dto: SaveScheduleDto) {
    await this.assertRegisterableEmployee(userId);
    this.assertEmployeeCanEdit(dto.weekStart);

    const weekStart = parseDateOnly(dto.weekStart);
    const week = await this.findOrCreateWeek(userId, weekStart, true);

    if (week.status === WorkScheduleStatus.APPROVED) {
      throw new BadRequestException(
        'Lịch đã duyệt, không thể sửa. Liên hệ Admin để từ chối và đăng ký lại.',
      );
    }
    if (week.status === WorkScheduleStatus.SUBMITTED) {
      throw new BadRequestException('Lịch đang chờ duyệt, không thể sửa');
    }

    this.validateShifts(dto.weekStart, dto.shifts);

    await this.replaceShifts(week.id, dto.shifts);

    const updated = await this.db.workScheduleWeek.findUniqueOrThrow({
      where: { id: week.id },
      include: this.weekInclude(),
    });

    return this.mapWeek(updated);
  }

  async submitMySchedule(userId: string, weekStartStr: string) {
    await this.assertRegisterableEmployee(userId);
    this.assertEmployeeCanEdit(weekStartStr);

    const weekStart = parseDateOnly(weekStartStr);
    const week = await this.db.workScheduleWeek.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      include: { shifts: true },
    });

    if (!week) {
      throw new BadRequestException('Chưa có lịch để gửi duyệt');
    }
    if (week.status === WorkScheduleStatus.APPROVED) {
      throw new BadRequestException('Lịch đã được duyệt');
    }
    if (week.status === WorkScheduleStatus.SUBMITTED) {
      throw new BadRequestException('Lịch đã được gửi duyệt');
    }
    if (week.shifts.length === 0) {
      throw new BadRequestException('Chọn ít nhất một ca trước khi gửi duyệt');
    }

    const updated = await this.db.workScheduleWeek.update({
      where: { id: week.id },
      data: {
        status: WorkScheduleStatus.SUBMITTED,
        submittedAt: new Date(),
        rejectReason: null,
        reviewedAt: null,
        reviewedById: null,
      },
      include: this.weekInclude(),
    });

    return this.mapWeek(updated);
  }

  async getPendingSchedules() {
    const weeks = await this.db.workScheduleWeek.findMany({
      where: { status: WorkScheduleStatus.SUBMITTED },
      include: this.weekInclude(),
      orderBy: [{ weekStart: 'asc' }, { submittedAt: 'asc' }],
    });
    return weeks.map((w) => this.mapWeek(w));
  }

  async getOverview(weekStartStr: string) {
    const weekStart = parseDateOnly(weekStartStr);
    const employees = await this.db.user.findMany({
      where: {
        role: { in: REGISTER_ROLES },
        status: UserStatus.ACTIVE,
      },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });

    const weeks = await this.db.workScheduleWeek.findMany({
      where: { weekStart },
      include: this.weekInclude(),
    });

    const weekMap = new Map(weeks.map((w) => [w.userId, w]));

    return {
      weekStart: weekStartStr,
      weekDates: getWeekDates(weekStart).map(formatDateOnly),
      employees: employees.map((emp) => {
        const week = weekMap.get(emp.id);
        return {
          user: emp,
          schedule: week ? this.mapWeek(week) : null,
        };
      }),
    };
  }

  async getUserSchedule(userId: string, weekStartStr: string) {
    await this.assertStaffUser(userId);
    const weekStart = parseDateOnly(weekStartStr);
    const week = await this.db.workScheduleWeek.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      include: this.weekInclude(),
    });
    return week ? this.mapWeek(week) : null;
  }

  async adminSaveSchedule(
    adminId: string,
    targetUserId: string,
    dto: AdminSaveScheduleDto,
  ) {
    await this.assertStaffUser(targetUserId);

    const weekStart = parseDateOnly(dto.weekStart);
    let week = await this.db.workScheduleWeek.findUnique({
      where: { userId_weekStart: { userId: targetUserId, weekStart } },
    });

    if (week?.status === WorkScheduleStatus.APPROVED && !dto.approve) {
      throw new BadRequestException(
        'Lịch đã duyệt. Admin cần từ chối trước hoặc dùng tùy chọn duyệt lại (approve=true) để ghi đè.',
      );
    }

    if (!week) {
      week = await this.db.workScheduleWeek.create({
        data: { userId: targetUserId, weekStart },
      });
    }

    this.validateShifts(dto.weekStart, dto.shifts);
    await this.replaceShifts(week.id, dto.shifts);

    const isOverrideApproved =
      week.status === WorkScheduleStatus.APPROVED && dto.approve;
    const status = dto.approve
      ? WorkScheduleStatus.APPROVED
      : week.status === WorkScheduleStatus.SUBMITTED
        ? WorkScheduleStatus.SUBMITTED
        : WorkScheduleStatus.DRAFT;

    const updated = await this.db.workScheduleWeek.update({
      where: { id: week.id },
      data: {
        status,
        submittedAt:
          dto.approve && !week.submittedAt ? new Date() : week.submittedAt,
        reviewedAt: dto.approve || isOverrideApproved ? new Date() : null,
        reviewedById: dto.approve || isOverrideApproved ? adminId : null,
        rejectReason: dto.approve ? null : week.rejectReason,
      },
      include: this.weekInclude(),
    });

    return this.mapWeek(updated);
  }

  async approveSchedule(weekId: string, adminId: string) {
    const week = await this.getWeekOrThrow(weekId);
    if (week.status !== WorkScheduleStatus.SUBMITTED) {
      throw new BadRequestException('Chỉ duyệt lịch đang chờ duyệt');
    }

    const updated = await this.db.workScheduleWeek.update({
      where: { id: weekId },
      data: {
        status: WorkScheduleStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectReason: null,
      },
      include: this.weekInclude(),
    });

    return this.mapWeek(updated);
  }

  async rejectSchedule(
    weekId: string,
    adminId: string,
    dto: RejectScheduleDto,
  ) {
    const week = await this.getWeekOrThrow(weekId);
    if (week.status === WorkScheduleStatus.APPROVED) {
      throw new BadRequestException(
        'Không thể từ chối trực tiếp lịch đã duyệt qua endpoint này',
      );
    }

    const updated = await this.db.workScheduleWeek.update({
      where: { id: weekId },
      data: {
        status: WorkScheduleStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectReason: dto.rejectReason,
      },
      include: this.weekInclude(),
    });

    return this.mapWeek(updated);
  }

  async rejectApprovedSchedule(
    weekId: string,
    adminId: string,
    dto: RejectScheduleDto,
  ) {
    const week = await this.getWeekOrThrow(weekId);
    if (week.status !== WorkScheduleStatus.APPROVED) {
      throw new BadRequestException('Chỉ áp dụng cho lịch đã duyệt');
    }

    const updated = await this.db.workScheduleWeek.update({
      where: { id: weekId },
      data: {
        status: WorkScheduleStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectReason: dto.rejectReason,
      },
      include: this.weekInclude(),
    });

    return this.mapWeek(updated);
  }

  private weekInclude() {
    return {
      shifts: {
        orderBy: [{ workDate: 'asc' as const }, { shiftType: 'asc' as const }],
      },
      user: { select: { id: true, fullName: true, role: true } },
      reviewer: { select: { id: true, fullName: true } },
    };
  }

  private async findOrCreateWeek(
    userId: string,
    weekStart: Date,
    createIfMissing: boolean,
  ) {
    let week = await this.db.workScheduleWeek.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      include: this.weekInclude(),
    });

    if (!week && createIfMissing) {
      week = await this.db.workScheduleWeek.create({
        data: { userId, weekStart },
        include: this.weekInclude(),
      });
    }

    if (!week) {
      throw new NotFoundException('Chưa có lịch làm việc cho tuần này');
    }

    return week;
  }

  private async getWeekOrThrow(weekId: string) {
    const week = await this.db.workScheduleWeek.findUnique({
      where: { id: weekId },
      include: this.weekInclude(),
    });
    if (!week) throw new NotFoundException('Không tìm thấy lịch làm việc');
    return week;
  }

  private async replaceShifts(weekId: string, shifts: ShiftRegistrationDto[]) {
    await this.db.workShiftRegistration.deleteMany({ where: { weekId } });
    if (shifts.length === 0) return;

    await this.db.workShiftRegistration.createMany({
      data: shifts.map((s) => ({
        weekId,
        workDate: parseDateOnly(s.workDate),
        shiftType: s.shiftType,
      })),
    });
  }

  private validateShifts(weekStartStr: string, shifts: ShiftRegistrationDto[]) {
    const weekStart = parseDateOnly(weekStartStr);
    const validDates = new Set(getWeekDates(weekStart).map(formatDateOnly));

    for (const shift of shifts) {
      if (!validDates.has(shift.workDate)) {
        throw new BadRequestException(
          `Ngày ${shift.workDate} không thuộc tuần bắt đầu ${weekStartStr}`,
        );
      }
    }

    const unique = new Set(shifts.map((s) => `${s.workDate}:${s.shiftType}`));
    if (unique.size !== shifts.length) {
      throw new BadRequestException('Trùng ca trong cùng ngày');
    }
  }

  private assertEmployeeCanEdit(weekStartStr: string) {
    if (!isRegistrationOpen()) {
      throw new ForbiddenException(
        'Chỉ được đăng ký/sửa lịch vào Chủ nhật cho tuần tới',
      );
    }
    const expected = formatDateOnly(getRegistrationWeekStart());
    if (weekStartStr !== expected) {
      throw new BadRequestException(
        `Chỉ được đăng ký cho tuần bắt đầu ${expected}`,
      );
    }
  }

  private async assertRegisterableEmployee(userId: string) {
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        role: { in: REGISTER_ROLES },
        status: UserStatus.ACTIVE,
      },
    });
    if (!user) {
      throw new ForbiddenException('Chỉ nhân viên/thu ngân mới đăng ký ca');
    }
  }

  private async assertStaffUser(userId: string) {
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        role: { in: STAFF_ROLES },
        status: UserStatus.ACTIVE,
      },
    });
    if (!user) {
      throw new BadRequestException('Người dùng không phải nhân viên');
    }
  }

  private mapWeek(week: {
    id: string;
    userId: string;
    weekStart: Date;
    status: WorkScheduleStatus;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    rejectReason: string | null;
    shifts: { id: string; workDate: Date; shiftType: ShiftType }[];
    user?: { id: string; fullName: string; role: string } | null;
    reviewer?: { id: string; fullName: string } | null;
  }) {
    return {
      id: week.id,
      userId: week.userId,
      weekStart: formatDateOnly(week.weekStart),
      status: week.status,
      submittedAt: week.submittedAt,
      reviewedAt: week.reviewedAt,
      rejectReason: week.rejectReason,
      user: week.user ?? null,
      reviewer: week.reviewer ?? null,
      shifts: week.shifts.map((s) => ({
        id: s.id,
        workDate: formatDateOnly(s.workDate),
        shiftType: s.shiftType,
        label: SHIFT_LABELS[s.shiftType],
      })),
      weekDates: getWeekDates(week.weekStart).map(formatDateOnly),
    };
  }
}
