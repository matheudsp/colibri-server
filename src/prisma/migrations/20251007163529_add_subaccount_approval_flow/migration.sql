/*
  Warnings:

  - You are about to drop the `LaunchNotification` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "SubAccount" ALTER COLUMN "asaasAccountId" DROP NOT NULL,
ALTER COLUMN "apiKey" DROP NOT NULL;

-- DropTable
DROP TABLE "LaunchNotification";
