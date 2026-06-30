-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "WorkScheduleStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('BONUS', 'PENALTY');

-- CreateTable
CREATE TABLE "work_schedule_weeks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "WorkScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedule_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_shift_registrations" (
    "id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "shift_type" "ShiftType" NOT NULL,

    CONSTRAINT "work_shift_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "day_shift_rate" DECIMAL(12,2) NOT NULL DEFAULT 150000,
    "evening_shift_rate" DECIMAL(12,2) NOT NULL DEFAULT 180000,
    "night_shift_rate" DECIMAL(12,2) NOT NULL DEFAULT 200000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_adjustments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "period_month" DATE NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_weeks_user_id_week_start_key" ON "work_schedule_weeks"("user_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "work_shift_registrations_week_id_work_date_shift_type_key" ON "work_shift_registrations"("week_id", "work_date", "shift_type");

-- AddForeignKey
ALTER TABLE "work_schedule_weeks" ADD CONSTRAINT "work_schedule_weeks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_weeks" ADD CONSTRAINT "work_schedule_weeks_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_shift_registrations" ADD CONSTRAINT "work_shift_registrations_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "work_schedule_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
