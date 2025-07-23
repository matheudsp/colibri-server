-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "condominiumId" TEXT,
ALTER COLUMN "cep" DROP NOT NULL,
ALTER COLUMN "street" DROP NOT NULL,
ALTER COLUMN "district" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "state" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Condominium" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,

    CONSTRAINT "Condominium_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Condominium" ADD CONSTRAINT "Condominium_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
