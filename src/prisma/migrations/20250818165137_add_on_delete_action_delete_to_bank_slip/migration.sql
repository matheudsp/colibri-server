-- DropForeignKey
ALTER TABLE "BankSlip" DROP CONSTRAINT "BankSlip_paymentOrderId_fkey";

-- AddForeignKey
ALTER TABLE "BankSlip" ADD CONSTRAINT "BankSlip_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
