/*
  Warnings:

  - You are about to drop the column `userId` on the `Document` table. All the data in the column will be lost.
  - Made the column `contractId` on table `Document` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_contractId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "userId",
ALTER COLUMN "contractId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
