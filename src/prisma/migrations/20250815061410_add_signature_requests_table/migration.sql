/*
  Warnings:

  - You are about to drop the column `requestSignatureKey` on the `GeneratedPdf` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "GeneratedPdf_requestSignatureKey_key";

-- AlterTable
ALTER TABLE "GeneratedPdf" DROP COLUMN "requestSignatureKey";

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "requestSignatureKey" TEXT NOT NULL,
    "generatedPdfId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_requestSignatureKey_key" ON "SignatureRequest"("requestSignatureKey");

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_generatedPdfId_fkey" FOREIGN KEY ("generatedPdfId") REFERENCES "GeneratedPdf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
