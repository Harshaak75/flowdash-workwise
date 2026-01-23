-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TaskWorkLog" ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "Task_tenantId_idx" ON "Task"("tenantId");

-- CreateIndex
CREATE INDEX "Task_tenantId_assigneeId_idx" ON "Task"("tenantId", "assigneeId");
