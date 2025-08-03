/*
  Warnings:

  - The values [CONTRATO_ALUGUEL] on the enum `DocumentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "PdfType" AS ENUM ('CONTRATO_LOCACAO');

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('IDENTIDADE_FRENTE', 'IDENTIDADE_VERSO', 'CPF', 'COMPROVANTE_RENDA', 'COMPROVANTE_ENDERECO');
ALTER TABLE "Document" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "DocumentType_old";
COMMIT;

-- CreateTable
CREATE TABLE "GeneratedPdf" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "type" "PdfType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractId" TEXT NOT NULL,

    CONSTRAINT "GeneratedPdf_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GeneratedPdf" ADD CONSTRAINT "GeneratedPdf_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
