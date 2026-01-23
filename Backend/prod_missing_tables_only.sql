CREATE TABLE IF NOT EXISTS "UserAttendance" (
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

CREATE INDEX IF NOT EXISTS "UserAttendance_userId_idx"
ON "UserAttendance"("userId");

CREATE INDEX IF NOT EXISTS "UserAttendance_workDate_idx"
ON "UserAttendance"("workDate");

CREATE UNIQUE INDEX IF NOT EXISTS "UserAttendance_userId_workDate_key"
ON "UserAttendance"("userId", "workDate");

ALTER TABLE "UserAttendance"
ADD CONSTRAINT "UserAttendance_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


CREATE TABLE IF NOT EXISTS "BreakLog" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "breakStart" TIMESTAMP(3) NOT NULL,
    "breakEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BreakLog_pkey" PRIMARY KEY ("id")
);


CREATE INDEX IF NOT EXISTS "BreakLog_attendanceId_idx"
ON "BreakLog"("attendanceId");

ALTER TABLE "BreakLog"
ADD CONSTRAINT "BreakLog_attendanceId_fkey"
FOREIGN KEY ("attendanceId")
REFERENCES "UserAttendance"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "KanbanBoard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KanbanBoard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KanbanColumn" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "boardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KanbanColumn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KanbanColumn_boardId_idx"
ON "KanbanColumn"("boardId");

ALTER TABLE "KanbanColumn"
ADD CONSTRAINT "KanbanColumn_boardId_fkey"
FOREIGN KEY ("boardId")
REFERENCES "KanbanBoard"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "KanbanIssue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimate" TEXT,
    "assigneeName" TEXT,
    "columnId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KanbanIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KanbanIssue_columnId_idx"
ON "KanbanIssue"("columnId");

ALTER TABLE "KanbanIssue"
ADD CONSTRAINT "KanbanIssue_columnId_fkey"
FOREIGN KEY ("columnId")
REFERENCES "KanbanColumn"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "KanbanIssue"
ADD CONSTRAINT "KanbanIssue_createdBy_fkey"
FOREIGN KEY ("createdBy")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

