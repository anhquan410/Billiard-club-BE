-- AlterTable
ALTER TABLE "table_bookings" ADD COLUMN "customer_id" TEXT;

-- AddForeignKey
ALTER TABLE "table_bookings" ADD CONSTRAINT "table_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
