/*
  Warnings:

  - The values [AGUARDANDO_PAGAMENTO_CAUCAO] on the enum `ContractStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ContractStatus_new" AS ENUM ('PENDENTE_DOCUMENTACAO', 'EM_ANALISE', 'AGUARDANDO_ASSINATURAS', 'AGUARDANDO_GARANTIA', 'ATIVO', 'FINALIZADO', 'CANCELADO');
ALTER TABLE "Contract" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Contract" ALTER COLUMN "status" TYPE "ContractStatus_new" USING ("status"::text::"ContractStatus_new");
ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";
ALTER TYPE "ContractStatus_new" RENAME TO "ContractStatus";
DROP TYPE "ContractStatus_old";
ALTER TABLE "Contract" ALTER COLUMN "status" SET DEFAULT 'PENDENTE_DOCUMENTACAO';
COMMIT;
