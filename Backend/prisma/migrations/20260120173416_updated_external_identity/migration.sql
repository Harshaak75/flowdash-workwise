/*
  Warnings:

  - A unique constraint covering the columns `[email,tenantId]` on the table `ExternalIdentity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,subject,tenantId]` on the table `ExternalIdentity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."ExternalIdentity_email_key";

-- AlterTable
ALTER TABLE "ExternalIdentity" ADD COLUMN     "tenantId" TEXT,
ALTER COLUMN "provider" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_email_tenantId_key" ON "ExternalIdentity"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_provider_subject_tenantId_key" ON "ExternalIdentity"("provider", "subject", "tenantId");
