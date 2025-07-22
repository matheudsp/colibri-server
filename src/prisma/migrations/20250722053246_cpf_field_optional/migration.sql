/*
  Warnings:

  - The `status` column on the `Document` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `birthDate` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('REPROVADO', 'AGUARDANDO_APROVACAO', 'APROVADO');

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "status",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'AGUARDANDO_APROVACAO';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "birthDate",
ALTER COLUMN "cpf" DROP NOT NULL;
