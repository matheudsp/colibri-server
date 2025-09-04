/*
  Warnings:

  - You are about to drop the column `rentValue` on the `Property` table. All the data in the column will be lost.
  - Added the required column `value` to the `Property` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PropertyTransactionType" AS ENUM ('VENDA', 'LOCACAO');

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "rentValue",
ADD COLUMN     "transactionType" "PropertyTransactionType" NOT NULL DEFAULT 'LOCACAO',
ADD COLUMN     "value" DECIMAL(65,30) NOT NULL;

-- CreateIndex
CREATE INDEX "property_search_idx" ON "Property"("title", "street", "district", "city", "state", "cep");
