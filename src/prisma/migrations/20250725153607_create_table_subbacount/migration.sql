/*
  Warnings:

  - You are about to drop the column `asaasSubAccountId` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_asaasSubAccountId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "asaasSubAccountId";

-- CreateTable
CREATE TABLE "SubAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asaasAccountId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_userId_key" ON "SubAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_asaasAccountId_key" ON "SubAccount"("asaasAccountId");

-- AddForeignKey
ALTER TABLE "SubAccount" ADD CONSTRAINT "SubAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
