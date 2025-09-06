/*
  Warnings:

  - You are about to drop the column `verificationToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verificationTokenExpiry` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_verificationToken_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "verificationToken",
DROP COLUMN "verificationTokenExpiry",
ADD COLUMN     "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
