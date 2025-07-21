/*
  Warnings:

  - The values [LAUDO_VISTORIA_ENTRADA,LAUDO_VISTORIA_SAIDA] on the enum `DocumentType` will be removed. If these variants are still used in the database, this will fail.
  - The values [VISTORIADOR] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `ambienteId` on the `Foto` table. All the data in the column will be lost.
  - You are about to drop the column `itemVistoriaId` on the `Foto` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `Log` table. All the data in the column will be lost.
  - You are about to drop the column `cameraType` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AccessKey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ambiente` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Contrato` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Imovel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ItemVistoria` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pagamento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Vistoria` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `propertyId` to the `Foto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('IDENTIDADE_FRENTE', 'IDENTIDADE_VERSO', 'CPF', 'COMPROVANTE_RENDA', 'COMPROVANTE_ENDERECO', 'CONTRATO_ALUGUEL');
ALTER TABLE "Documento" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "DocumentType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'LOCADOR', 'LOCATARIO');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'LOCATARIO';
COMMIT;

-- DropForeignKey
ALTER TABLE "AccessKey" DROP CONSTRAINT "AccessKey_userId_fkey";

-- DropForeignKey
ALTER TABLE "AccessKey" DROP CONSTRAINT "AccessKey_vistoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Ambiente" DROP CONSTRAINT "Ambiente_vistoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_imovelId_fkey";

-- DropForeignKey
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_landlordId_fkey";

-- DropForeignKey
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Documento" DROP CONSTRAINT "Documento_contractId_fkey";

-- DropForeignKey
ALTER TABLE "Foto" DROP CONSTRAINT "Foto_ambienteId_fkey";

-- DropForeignKey
ALTER TABLE "Foto" DROP CONSTRAINT "Foto_itemVistoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Imovel" DROP CONSTRAINT "Imovel_landlordId_fkey";

-- DropForeignKey
ALTER TABLE "ItemVistoria" DROP CONSTRAINT "ItemVistoria_ambienteId_fkey";

-- DropForeignKey
ALTER TABLE "Pagamento" DROP CONSTRAINT "Pagamento_contractId_fkey";

-- DropForeignKey
ALTER TABLE "Vistoria" DROP CONSTRAINT "Vistoria_contractId_fkey";

-- DropForeignKey
ALTER TABLE "Vistoria" DROP CONSTRAINT "Vistoria_imovelId_fkey";

-- DropForeignKey
ALTER TABLE "Vistoria" DROP CONSTRAINT "Vistoria_inspectorId_fkey";

-- AlterTable
ALTER TABLE "Foto" DROP COLUMN "ambienteId",
DROP COLUMN "itemVistoriaId",
ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Log" DROP COLUMN "details";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "cameraType",
DROP COLUMN "status",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "AccessKey";

-- DropTable
DROP TABLE "Ambiente";

-- DropTable
DROP TABLE "Contrato";

-- DropTable
DROP TABLE "Imovel";

-- DropTable
DROP TABLE "ItemVistoria";

-- DropTable
DROP TABLE "Pagamento";

-- DropTable
DROP TABLE "Vistoria";

-- DropEnum
DROP TYPE "CameraType";

-- DropEnum
DROP TYPE "InspectionType";

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "areaInM2" DOUBLE PRECISION NOT NULL,
    "numRooms" INTEGER NOT NULL DEFAULT 0,
    "numBathrooms" INTEGER NOT NULL DEFAULT 0,
    "numParking" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "landlordId" TEXT NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDENTE_DOCUMENTACAO',
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "condoFee" DOUBLE PRECISION,
    "iptuFee" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationInMonths" INTEGER NOT NULL,
    "guaranteeType" "GuaranteeType" NOT NULL DEFAULT 'SEM_GARANTIA',
    "securityDeposit" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
