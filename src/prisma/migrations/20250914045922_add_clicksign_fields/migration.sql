/*
  Warnings:

  - Added the required column `updatedAt` to the `GeneratedPdf` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SignatureRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'STARTED', 'SIGNED', 'CLOSED', 'REFUSED', 'UPLOADED');

-- AlterTable
ALTER TABLE "GeneratedPdf" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "clicksignDocumentId" TEXT,
ADD COLUMN     "clicksignEnvelopeId" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "finalPdfUrl" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "SignatureRequest_clicksignDocumentId_idx" ON "SignatureRequest"("clicksignDocumentId");

-- CreateIndex
CREATE INDEX "SignatureRequest_clicksignEnvelopeId_idx" ON "SignatureRequest"("clicksignEnvelopeId");
