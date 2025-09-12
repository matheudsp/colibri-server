/*
  Warnings:

  - You are about to drop the `Webhook` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `dueDate` to the `BankSlip` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Webhook" DROP CONSTRAINT "Webhook_userId_fkey";

-- AlterTable
ALTER TABLE "BankSlip" ADD COLUMN     "dueDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "Transfer" ALTER COLUMN "asaasTransferId" DROP NOT NULL;

-- DropTable
DROP TABLE "Webhook";
