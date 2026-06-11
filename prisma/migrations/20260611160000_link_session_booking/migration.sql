-- AlterTable
ALTER TABLE "table_sessions" ADD COLUMN "booking_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "table_sessions_booking_id_key" ON "table_sessions"("booking_id");

-- AddForeignKey
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "table_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
