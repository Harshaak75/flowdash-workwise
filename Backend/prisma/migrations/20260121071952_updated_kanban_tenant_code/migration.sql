/*
  Warnings:

  - Made the column `tenantId` on table `KanbanBoard` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "KanbanBoard" ALTER COLUMN "tenantId" SET NOT NULL;
