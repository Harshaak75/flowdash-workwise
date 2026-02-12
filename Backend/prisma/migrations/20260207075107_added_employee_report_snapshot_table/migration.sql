-- CreateTable
CREATE TABLE "EmployeeReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "totalTasks" INTEGER NOT NULL,
    "completedTasks" INTEGER NOT NULL,
    "todoTasks" INTEGER NOT NULL,
    "workingTasks" INTEGER NOT NULL,
    "doneTasks" INTEGER NOT NULL,
    "completionRate" INTEGER NOT NULL,
    "totalHours" INTEGER NOT NULL,
    "avgDailyHours" DOUBLE PRECISION NOT NULL,
    "productivityScore" INTEGER NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeReportSnapshot_reportId_idx" ON "EmployeeReportSnapshot"("reportId");

-- CreateIndex
CREATE INDEX "EmployeeReportSnapshot_userId_idx" ON "EmployeeReportSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeReportSnapshot_reportId_userId_key" ON "EmployeeReportSnapshot"("reportId", "userId");

-- AddForeignKey
ALTER TABLE "EmployeeReportSnapshot" ADD CONSTRAINT "EmployeeReportSnapshot_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeReportSnapshot" ADD CONSTRAINT "EmployeeReportSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
