/*
  Warnings:

  - You are about to drop the column `asaasWalletId` on the `BankAccount` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[asaasWalletId]` on the table `SubAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "BankAccount_asaasWalletId_key";

-- AlterTable
ALTER TABLE "BankAccount" DROP COLUMN "asaasWalletId";

-- AlterTable
ALTER TABLE "SubAccount" ADD COLUMN     "asaasWalletId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_asaasWalletId_key" ON "SubAccount"("asaasWalletId");
