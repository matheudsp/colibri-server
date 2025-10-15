/*
  Warnings:

  - You are about to drop the column `pixPayload` on the `Charge` table. All the data in the column will be lost.
  - You are about to drop the column `pixQrCode` on the `Charge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Charge" DROP COLUMN "pixPayload",
DROP COLUMN "pixQrCode";
