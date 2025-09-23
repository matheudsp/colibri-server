-- CreateEnum
CREATE TYPE "PixAddressKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');

-- CreateEnum
CREATE TYPE "PropertyTransactionType" AS ENUM ('VENDA', 'LOCACAO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LOCADOR', 'LOCATARIO');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDENTE_DOCUMENTACAO', 'EM_ANALISE', 'AGUARDANDO_ASSINATURAS', 'ATIVO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTAMENTO', 'APARTAMENTO_DUPLEX', 'APARTAMENTO_TRIPLEX', 'CASA', 'CHACARA', 'KITNET', 'LOJA_SALA', 'PREDIO', 'TERRENO');

-- CreateEnum
CREATE TYPE "PdfType" AS ENUM ('CONTRATO_LOCACAO');

-- CreateEnum
CREATE TYPE "GuaranteeType" AS ENUM ('DEPOSITO_CAUCAO', 'FIADOR', 'SEGURO_FIANCA', 'SEM_GARANTIA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IDENTIDADE_FRENTE', 'IDENTIDADE_VERSO', 'CPF', 'COMPROVANTE_RENDA', 'COMPROVANTE_ENDERECO');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('REPROVADO', 'AGUARDANDO_APROVACAO', 'APROVADO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'ISENTO', 'CONFIRMADO', 'FALHOU', 'CANCELADO', 'EM_REPASSE', 'RECEBIDO');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'STARTED', 'SIGNED', 'CLOSED', 'REFUSED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('PENDING', 'CONTACTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'LOCATARIO',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB,
    "asaasCustomerId" TEXT,
    "emailVerificationToken" TEXT,
    "emailVerificationTokenExpiry" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "birthDate" DATE,
    "companyType" "CompanyType",
    "incomeValue" DECIMAL(65,30),
    "cep" TEXT,
    "street" TEXT,
    "number" TEXT,
    "city" TEXT,
    "state" TEXT,
    "province" TEXT,
    "complement" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asaasWalletId" TEXT,
    "asaasAccountId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "asaasWebhookToken" TEXT,
    "onboardingUrl" TEXT,
    "statusGeneral" TEXT,
    "statusDocumentation" TEXT,
    "statusCommercialInfo" TEXT,
    "statusBankAccountInfo" TEXT,
    "platformFeePercentage" DECIMAL(65,30) DEFAULT 5.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsaasCustomer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subaccountId" TEXT NOT NULL,
    "asaasCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsaasCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pixAddressKey" TEXT NOT NULL,
    "pixAddressKeyType" "PixAddressKeyType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "transactionType" "PropertyTransactionType" NOT NULL DEFAULT 'LOCACAO',
    "value" DECIMAL(65,30) NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "cep" TEXT,
    "street" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "areaInM2" DOUBLE PRECISION NOT NULL,
    "numRooms" INTEGER NOT NULL DEFAULT 0,
    "numBathrooms" INTEGER NOT NULL DEFAULT 0,
    "numParking" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "condominiumId" TEXT,
    "landlordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDENTE_DOCUMENTACAO',
    "rentAmount" DECIMAL(65,30) NOT NULL,
    "condoFee" DECIMAL(65,30),
    "iptuFee" DECIMAL(65,30),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationInMonths" INTEGER NOT NULL,
    "guaranteeType" "GuaranteeType" NOT NULL DEFAULT 'SEM_GARANTIA',
    "securityDeposit" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPdf" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "pdfType" "PdfType" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "signedFilePath" TEXT,
    "clicksignEnvelopeId" TEXT,
    "contractId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedPdf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "clicksignSignerId" TEXT NOT NULL,
    "clicksignDocumentId" TEXT,
    "clicksignEnvelopeId" TEXT,
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "finalPdfUrl" TEXT,
    "generatedPdfId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amountDue" DECIMAL(65,30) NOT NULL,
    "amountPaid" DECIMAL(65,30),
    "netValue" DECIMAL(65,30),
    "dueDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATE,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "asaasTransferId" TEXT,
    "paymentOrderId" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "value" DECIMAL(65,30) NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSplit" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "PaymentSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSlip" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "asaasChargeId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "bankSlipUrl" TEXT NOT NULL,
    "transactionReceiptUrl" TEXT,
    "invoiceUrl" TEXT NOT NULL,
    "nossoNumero" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "name" TEXT,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'AGUARDANDO_APROVACAO',
    "contractId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "message" TEXT,
    "status" "InterestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpfCnpj_key" ON "User"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "User_asaasCustomerId_key" ON "User"("asaasCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_userId_key" ON "SubAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_asaasWalletId_key" ON "SubAccount"("asaasWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_asaasAccountId_key" ON "SubAccount"("asaasAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_asaasWebhookToken_key" ON "SubAccount"("asaasWebhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCustomer_asaasCustomerId_key" ON "AsaasCustomer"("asaasCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCustomer_tenantId_subaccountId_key" ON "AsaasCustomer"("tenantId", "subaccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_userId_key" ON "BankAccount"("userId");

-- CreateIndex
CREATE INDEX "property_search_idx" ON "Property"("title", "street", "district", "city", "state", "cep");

-- CreateIndex
CREATE INDEX "Property_landlordId_idx" ON "Property"("landlordId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPdf_clicksignEnvelopeId_key" ON "GeneratedPdf"("clicksignEnvelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_clicksignSignerId_key" ON "SignatureRequest"("clicksignSignerId");

-- CreateIndex
CREATE INDEX "SignatureRequest_clicksignDocumentId_idx" ON "SignatureRequest"("clicksignDocumentId");

-- CreateIndex
CREATE INDEX "SignatureRequest_clicksignEnvelopeId_idx" ON "SignatureRequest"("clicksignEnvelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_asaasTransferId_key" ON "Transfer"("asaasTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_paymentOrderId_key" ON "Transfer"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSlip_paymentOrderId_key" ON "BankSlip"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSlip_asaasChargeId_key" ON "BankSlip"("asaasChargeId");

-- CreateIndex
CREATE INDEX "Interest_tenantId_idx" ON "Interest"("tenantId");

-- CreateIndex
CREATE INDEX "Interest_landlordId_idx" ON "Interest"("landlordId");

-- AddForeignKey
ALTER TABLE "SubAccount" ADD CONSTRAINT "SubAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCustomer" ADD CONSTRAINT "AsaasCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCustomer" ADD CONSTRAINT "AsaasCustomer_subaccountId_fkey" FOREIGN KEY ("subaccountId") REFERENCES "SubAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condominium" ADD CONSTRAINT "Condominium_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPdf" ADD CONSTRAINT "GeneratedPdf_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_generatedPdfId_fkey" FOREIGN KEY ("generatedPdfId") REFERENCES "GeneratedPdf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSlip" ADD CONSTRAINT "BankSlip_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
