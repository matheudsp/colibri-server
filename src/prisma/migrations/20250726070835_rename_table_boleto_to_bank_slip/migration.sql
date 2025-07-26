/*
  Warnings:

  - You are about to drop the `Boleto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Boleto" DROP CONSTRAINT "Boleto_paymentOrderId_fkey";

-- DropTable
DROP TABLE "Boleto";

-- CreateTable
CREATE TABLE "BankSlip" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "asaasChargeId" TEXT NOT NULL,
    "bankSlipUrl" TEXT NOT NULL,
    "invoiceUrl" TEXT NOT NULL,
    "nossoNumero" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankSlip_paymentOrderId_key" ON "BankSlip"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSlip_asaasChargeId_key" ON "BankSlip"("asaasChargeId");

-- AddForeignKey
ALTER TABLE "BankSlip" ADD CONSTRAINT "BankSlip_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
