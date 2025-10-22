-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'SOLICITANDO_ALTERACAO';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "alterationRequestReason" TEXT;
