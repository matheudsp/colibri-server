-- DropForeignKey
ALTER TABLE "BankSlip" DROP CONSTRAINT "BankSlip_paymentOrderId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentSplit" DROP CONSTRAINT "PaymentSplit_paymentId_fkey";

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSlip" ADD CONSTRAINT "BankSlip_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
