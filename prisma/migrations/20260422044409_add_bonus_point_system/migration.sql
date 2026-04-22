/*
  Warnings:

  - Made the column `phone` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateEnum
CREATE TYPE "BonusTransactionType" AS ENUM ('EARNED', 'REDEEMED', 'ADJUSTED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "bonus_points_earned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bonus_points_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_from_points" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_from_tier" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bonus_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "membership_tier" "MembershipTier" NOT NULL DEFAULT 'BRONZE',
ALTER COLUMN "phone" SET NOT NULL;

-- CreateTable
CREATE TABLE "bonus_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" "BonusTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
