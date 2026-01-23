/*
  Warnings:

  - Made the column `tenantId` on table `ExternalIdentity` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ExternalIdentity" ALTER COLUMN "tenantId" SET NOT NULL;
