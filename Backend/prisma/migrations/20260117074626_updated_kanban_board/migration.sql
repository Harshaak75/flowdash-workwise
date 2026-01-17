/*
  Warnings:

  - You are about to drop the column `createdBy` on the `KanbanBoard` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."KanbanBoard" DROP CONSTRAINT "KanbanBoard_createdBy_fkey";

-- AlterTable
ALTER TABLE "KanbanBoard" DROP COLUMN "createdBy",
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'GLOBAL';
