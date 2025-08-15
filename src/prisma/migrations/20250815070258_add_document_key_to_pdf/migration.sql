/*
  Warnings:

  - A unique constraint covering the columns `[clicksignDocumentKey]` on the table `GeneratedPdf` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GeneratedPdf" ADD COLUMN     "clicksignDocumentKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPdf_clicksignDocumentKey_key" ON "GeneratedPdf"("clicksignDocumentKey");
