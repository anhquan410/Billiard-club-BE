/*
  Warnings:

  - The values [OTHER] on the enum `ProductCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `sku` on the `products` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `products` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProductCategory_new" AS ENUM ('FOOD', 'BEVERAGE', 'EQUIPMENT', 'SERVICE', 'ORTHER');
ALTER TABLE "products" ALTER COLUMN "category" TYPE "ProductCategory_new" USING ("category"::text::"ProductCategory_new");
ALTER TYPE "ProductCategory" RENAME TO "ProductCategory_old";
ALTER TYPE "ProductCategory_new" RENAME TO "ProductCategory";
DROP TYPE "public"."ProductCategory_old";
COMMIT;

-- DropIndex
DROP INDEX "products_sku_key";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "sku";

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");
