/*
  Warnings:

  - You are about to drop the column `createdAt` on the `GeneratedPdf` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `GeneratedPdf` table. All the data in the column will be lost.
  - Added the required column `generatedAt` to the `GeneratedPdf` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pdfType` to the `GeneratedPdf` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GeneratedPdf" DROP COLUMN "createdAt",
DROP COLUMN "type",
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "pdfType" "PdfType" NOT NULL,
ADD COLUMN     "signedFilePath" TEXT;
