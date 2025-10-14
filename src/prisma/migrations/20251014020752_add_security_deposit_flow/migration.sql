-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'AGUARDANDO_PAGAMENTO_CAUCAO';

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "isSecurityDeposit" BOOLEAN NOT NULL DEFAULT false;
