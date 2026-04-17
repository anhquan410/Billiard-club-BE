/*
  Warnings:

  - Added the required column `cashier_id` to the `table_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CASHIER';

-- DropForeignKey
ALTER TABLE "table_sessions" DROP CONSTRAINT "table_sessions_staff_id_fkey";

-- AlterTable: add cashier_id with default from staff_id, then drop default
ALTER TABLE "table_sessions" ADD COLUMN "cashier_id" TEXT;
UPDATE "table_sessions" SET "cashier_id" = "staff_id" WHERE "cashier_id" IS NULL;
ALTER TABLE "table_sessions" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "table_sessions" ALTER COLUMN "staff_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
