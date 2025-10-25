/*
  Warnings:

  - You are about to drop the column `district` on the `Condominium` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Property` table. All the data in the column will be lost.
  - Added the required column `province` to the `Condominium` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "property_search_idx";

-- AlterTable
ALTER TABLE "Condominium" DROP COLUMN "district",
ADD COLUMN     "province" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "district",
ADD COLUMN     "province" TEXT;

-- CreateIndex
CREATE INDEX "property_search_idx" ON "Property"("title", "street", "province", "city", "state", "cep");
