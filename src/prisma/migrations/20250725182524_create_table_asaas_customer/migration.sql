-- CreateTable
CREATE TABLE "AsaasCustomer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subaccountId" TEXT NOT NULL,
    "asaasCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsaasCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCustomer_asaasCustomerId_key" ON "AsaasCustomer"("asaasCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCustomer_tenantId_subaccountId_key" ON "AsaasCustomer"("tenantId", "subaccountId");

-- AddForeignKey
ALTER TABLE "AsaasCustomer" ADD CONSTRAINT "AsaasCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCustomer" ADD CONSTRAINT "AsaasCustomer_subaccountId_fkey" FOREIGN KEY ("subaccountId") REFERENCES "SubAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
