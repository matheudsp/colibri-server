/*
  Warnings:

  - You are about to drop the column `account` on the `BankAccount` table. All the data in the column will be lost.
  - You are about to drop the column `accountType` on the `BankAccount` table. All the data in the column will be lost.
  - You are about to drop the column `agency` on the `BankAccount` table. All the data in the column will be lost.
  - You are about to drop the column `bank` on the `BankAccount` table. All the data in the column will be lost.
  - You are about to drop the column `pixKey` on the `BankAccount` table. All the data in the column will be lost.
  - Added the required column `pixAddressKey` to the `BankAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pixAddressKeyType` to the `BankAccount` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PixAddressKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');

-- AlterTable
ALTER TABLE "BankAccount" DROP COLUMN "account",
DROP COLUMN "accountType",
DROP COLUMN "agency",
DROP COLUMN "bank",
DROP COLUMN "pixKey",
ADD COLUMN     "pixAddressKey" TEXT NOT NULL,
ADD COLUMN     "pixAddressKeyType" "PixAddressKeyType" NOT NULL;

-- DropEnum
DROP TYPE "BankAccountType";
