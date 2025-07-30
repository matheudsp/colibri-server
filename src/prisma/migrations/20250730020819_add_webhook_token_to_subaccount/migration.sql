/*
  Warnings:

  - A unique constraint covering the columns `[asaasWebhookToken]` on the table `SubAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PaymentOrder" ALTER COLUMN "paidAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SubAccount" ADD COLUMN     "asaasWebhookToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_asaasWebhookToken_key" ON "SubAccount"("asaasWebhookToken");
