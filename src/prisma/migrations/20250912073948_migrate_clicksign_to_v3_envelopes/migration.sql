/*
  Warnings:

  - You are about to drop the column `clicksignDocumentKey` on the `GeneratedPdf` table. All the data in the column will be lost.
  - You are about to drop the column `requestSignatureKey` on the `SignatureRequest` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clicksignEnvelopeId]` on the table `GeneratedPdf` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clicksignSignerId]` on the table `SignatureRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clicksignSignerId` to the `SignatureRequest` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GeneratedPdf_clicksignDocumentKey_key";

-- DropIndex
DROP INDEX "SignatureRequest_requestSignatureKey_key";

-- AlterTable
ALTER TABLE "GeneratedPdf" DROP COLUMN "clicksignDocumentKey",
ADD COLUMN     "clicksignEnvelopeId" TEXT;

-- AlterTable
ALTER TABLE "SignatureRequest" DROP COLUMN "requestSignatureKey",
ADD COLUMN     "clicksignSignerId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPdf_clicksignEnvelopeId_key" ON "GeneratedPdf"("clicksignEnvelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_clicksignSignerId_key" ON "SignatureRequest"("clicksignSignerId");
