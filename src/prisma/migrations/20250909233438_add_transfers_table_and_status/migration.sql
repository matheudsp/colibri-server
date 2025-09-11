-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'EM_REPASSE';

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "asaasTransferId" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "value" DECIMAL(65,30) NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_asaasTransferId_key" ON "Transfer"("asaasTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_paymentOrderId_key" ON "Transfer"("paymentOrderId");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
