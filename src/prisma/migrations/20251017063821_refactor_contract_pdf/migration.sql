/*
  Warnings:

  - The values [CONTRATO_LOCACAO] on the enum `PdfType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `clicksignEnvelopeId` on the `GeneratedPdf` table. All the data in the column will be lost.
  - You are about to drop the column `signedFilePath` on the `GeneratedPdf` table. All the data in the column will be lost.
  - You are about to drop the column `finalPdfUrl` on the `SignatureRequest` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clicksignEnvelopeId]` on the table `Contract` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contractId` to the `SignatureRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PdfType_new" AS ENUM ('RELATORIO_JUDICIAL');
ALTER TABLE "GeneratedPdf" ALTER COLUMN "pdfType" TYPE "PdfType_new" USING ("pdfType"::text::"PdfType_new");
ALTER TYPE "PdfType" RENAME TO "PdfType_old";
ALTER TYPE "PdfType_new" RENAME TO "PdfType";
DROP TYPE "PdfType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "GeneratedPdf" DROP CONSTRAINT "GeneratedPdf_contractId_fkey";

-- DropForeignKey
ALTER TABLE "SignatureRequest" DROP CONSTRAINT "SignatureRequest_generatedPdfId_fkey";

-- DropIndex
DROP INDEX "GeneratedPdf_clicksignEnvelopeId_key";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "clicksignEnvelopeId" TEXT,
ADD COLUMN     "contractFilePath" TEXT,
ADD COLUMN     "signedContractFilePath" TEXT;

-- AlterTable
ALTER TABLE "GeneratedPdf" DROP COLUMN "clicksignEnvelopeId",
DROP COLUMN "signedFilePath";

-- AlterTable
ALTER TABLE "SignatureRequest" DROP COLUMN "finalPdfUrl",
ADD COLUMN     "contractId" TEXT NOT NULL,
ALTER COLUMN "generatedPdfId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Contract_clicksignEnvelopeId_key" ON "Contract"("clicksignEnvelopeId");

-- AddForeignKey
ALTER TABLE "GeneratedPdf" ADD CONSTRAINT "GeneratedPdf_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_generatedPdfId_fkey" FOREIGN KEY ("generatedPdfId") REFERENCES "GeneratedPdf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
