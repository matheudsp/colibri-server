/*
  Warnings:

  - You are about to drop the `BankSlip` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BankSlip" DROP CONSTRAINT "BankSlip_paymentOrderId_fkey";

-- DropTable
DROP TABLE "BankSlip";

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "asaasChargeId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "bankSlipUrl" TEXT,
    "transactionReceiptUrl" TEXT,
    "pixQrCode" TEXT,
    "pixPayload" TEXT,
    "invoiceUrl" TEXT NOT NULL,
    "nossoNumero" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Charge_paymentOrderId_key" ON "Charge"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_asaasChargeId_key" ON "Charge"("asaasChargeId");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
