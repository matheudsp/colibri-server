-- DropForeignKey
ALTER TABLE "SignatureRequest" DROP CONSTRAINT "SignatureRequest_generatedPdfId_fkey";

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_generatedPdfId_fkey" FOREIGN KEY ("generatedPdfId") REFERENCES "GeneratedPdf"("id") ON DELETE CASCADE ON UPDATE CASCADE;
