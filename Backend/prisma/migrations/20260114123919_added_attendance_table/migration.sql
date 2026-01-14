-- CreateTable
CREATE TABLE "UserAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL,
    "logoutTime" TIMESTAMP(3),
    "breakStartTime" TIMESTAMP(3),
    "breakEndTime" TIMESTAMP(3),
    "totalBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalWorkingMinutes" INTEGER,
    "isActiveSession" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakLog" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "breakStart" TIMESTAMP(3) NOT NULL,
    "breakEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAttendance_userId_idx" ON "UserAttendance"("userId");

-- CreateIndex
CREATE INDEX "UserAttendance_workDate_idx" ON "UserAttendance"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserAttendance_userId_workDate_key" ON "UserAttendance"("userId", "workDate");

-- CreateIndex
CREATE INDEX "BreakLog_attendanceId_idx" ON "BreakLog"("attendanceId");

-- AddForeignKey
ALTER TABLE "UserAttendance" ADD CONSTRAINT "UserAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakLog" ADD CONSTRAINT "BreakLog_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "UserAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
