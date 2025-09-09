/*
  Warnings:

  - Made the column `emailVerified` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SubAccount" ADD COLUMN     "onboardingUrl" TEXT,
ADD COLUMN     "statusBankAccountInfo" TEXT,
ADD COLUMN     "statusCommercialInfo" TEXT,
ADD COLUMN     "statusDocumentation" TEXT,
ADD COLUMN     "statusGeneral" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET NOT NULL;
