/*
  Warnings:

  - The values [CONTRATO_LOCACAO] on the enum `PdfType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'EM_ELABORACAO';

-- AlterEnum
BEGIN;
CREATE TYPE "PdfType_new" AS ENUM ('RELATORIO_JUDICIAL');
ALTER TABLE "GeneratedPdf" ALTER COLUMN "pdfType" TYPE "PdfType_new" USING ("pdfType"::text::"PdfType_new");
ALTER TYPE "PdfType" RENAME TO "PdfType_old";
ALTER TYPE "PdfType_new" RENAME TO "PdfType";
DROP TYPE "PdfType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Contract" ALTER COLUMN "status" SET DEFAULT 'EM_ELABORACAO';
