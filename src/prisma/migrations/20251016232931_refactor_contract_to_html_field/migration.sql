/*
  Warnings:

  - You are about to drop the `Clause` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContractClause` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Clause" DROP CONSTRAINT "Clause_userId_fkey";

-- DropForeignKey
ALTER TABLE "ContractClause" DROP CONSTRAINT "ContractClause_clauseId_fkey";

-- DropForeignKey
ALTER TABLE "ContractClause" DROP CONSTRAINT "ContractClause_contractId_fkey";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "contractHtml" TEXT;

-- DropTable
DROP TABLE "Clause";

-- DropTable
DROP TABLE "ContractClause";
