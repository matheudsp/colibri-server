/*
  Warnings:

  - A unique constraint covering the columns `[requestSignatureKey]` on the table `GeneratedPdf` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GeneratedPdf" ADD COLUMN     "requestSignatureKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPdf_requestSignatureKey_key" ON "GeneratedPdf"("requestSignatureKey");
