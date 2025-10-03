-- CreateEnum
CREATE TYPE "MarketingChannel" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'REDDIT', 'INDICACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "PreferredPaymentMethod" AS ENUM ('PIX', 'BOLETO');

-- CreateTable
CREATE TABLE "UserMarketingSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "MarketingChannel",
    "preferredPaymentMethod" "PreferredPaymentMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMarketingSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchNotification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserMarketingSurvey_userId_key" ON "UserMarketingSurvey"("userId");

-- CreateIndex
CREATE INDEX "UserMarketingSurvey_userId_idx" ON "UserMarketingSurvey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchNotification_email_key" ON "LaunchNotification"("email");

-- AddForeignKey
ALTER TABLE "UserMarketingSurvey" ADD CONSTRAINT "UserMarketingSurvey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
