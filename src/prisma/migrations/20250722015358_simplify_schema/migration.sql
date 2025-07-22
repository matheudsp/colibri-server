/*
  Warnings:

  - You are about to drop the `Documento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Foto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Documento" DROP CONSTRAINT "Documento_contractId_fkey";

-- DropForeignKey
ALTER TABLE "Documento" DROP CONSTRAINT "Documento_userId_fkey";

-- DropForeignKey
ALTER TABLE "Foto" DROP CONSTRAINT "Foto_propertyId_fkey";

-- DropTable
DROP TABLE "Documento";

-- DropTable
DROP TABLE "Foto";

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "description" TEXT,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "userId" TEXT,
    "contractId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
