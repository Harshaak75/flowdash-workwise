-- AlterTable
ALTER TABLE "KanbanBoard" ADD COLUMN     "department" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "KanbanBoard_tenantId_department_idx" ON "KanbanBoard"("tenantId", "department");

-- CreateIndex
CREATE INDEX "KanbanBoard_ownerId_idx" ON "KanbanBoard"("ownerId");
