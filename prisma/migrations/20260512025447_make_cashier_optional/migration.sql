-- DropForeignKey
ALTER TABLE "table_sessions" DROP CONSTRAINT "table_sessions_cashier_id_fkey";

-- AlterTable
ALTER TABLE "table_sessions" ALTER COLUMN "cashier_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "refresh_token" SET DEFAULT '';

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
