/*
  Warnings:

  - Made the column `tenantId` on table `Employee` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "tenantId" SET NOT NULL;
