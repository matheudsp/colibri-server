/*
  Warnings:

  - You are about to drop the column `description` on the `Photo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Photo" DROP COLUMN "description",
ADD COLUMN     "name" TEXT;
