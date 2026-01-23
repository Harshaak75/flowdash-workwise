/*
  Warnings:

  - Added the required column `tenantId` to the `KanbanIssue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "KanbanIssue" ADD COLUMN     "tenantId" TEXT NOT NULL;
