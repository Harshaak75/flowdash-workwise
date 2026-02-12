"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const queue_1 = require("../lib/queue");
const db_1 = __importDefault(require("../db"));
const reportPdfWorker_1 = require("./reportPdfWorker");
const email_1 = require("../lib/email");
// Remove old commented code and clean up imports
const workerName = "report-generation";
const reportWorker = new bullmq_1.Worker(workerName, async (job) => {
    const { reportId, scope, employeeIds } = job.data;
    console.log(`Processing job ${job.id} for report ${reportId}`);
    // ----------------------------------
    // 1️⃣ Fetch report + generator
    // ----------------------------------
    const report = await db_1.default.report.findUnique({
        where: { id: reportId },
        include: { generator: true },
    });
    if (!report)
        throw new Error("Report not found");
    const generator = report.generator;
    // ----------------------------------
    // 2️⃣ Decide users to process (ROLE AWARE)
    // ----------------------------------
    let usersToProcess = [];
    // PROJECT MANAGER → all managers + all employees
    if (generator.role === "PROJECT_MANAGER") {
        if (scope === "EMPLOYEE") {
            usersToProcess = await db_1.default.user.findMany({
                where: {
                    id: { in: employeeIds },
                    tenantId: report.tenantId,
                },
            });
        }
        else {
            usersToProcess = await db_1.default.user.findMany({
                where: {
                    tenantId: report.tenantId,
                    role: { in: ["MANAGER", "OPERATOR"] },
                },
            });
        }
    }
    // MANAGER → only employees under them
    if (generator.role === "MANAGER") {
        if (scope === "EMPLOYEE") {
            usersToProcess = await db_1.default.user.findMany({
                where: {
                    id: { in: employeeIds },
                    tenantId: report.tenantId,
                    Employee: {
                        managerId: generator.id,
                    },
                },
            });
        }
        else {
            usersToProcess = await db_1.default.user.findMany({
                where: {
                    tenantId: report.tenantId,
                    role: "OPERATOR",
                    Employee: {
                        managerId: generator.id,
                    },
                },
            });
        }
    }
    // ----------------------------------
    // 3️⃣ Generate SNAPSHOTS
    // ----------------------------------
    for (const user of usersToProcess) {
        const tasks = await db_1.default.task.findMany({
            where: {
                assigneeId: user.id,
                createdAt: {
                    gte: report.fromDate,
                    lte: report.toDate,
                },
            },
        });
        const workLogs = await db_1.default.taskWorkLog.findMany({
            where: {
                userId: user.id,
                startTime: { gte: report.fromDate },
                endTime: { lte: report.toDate },
            },
        });
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === "DONE").length;
        const todoTasks = tasks.filter(t => t.status === "TODO").length;
        const workingTasks = tasks.filter(t => t.status === "WORKING").length;
        const totalMinutes = workLogs.reduce((sum, log) => {
            if (!log.endTime)
                return sum;
            return sum + (log.endTime.getTime() - log.startTime.getTime()) / 60000;
        }, 0);
        const totalHours = Math.round(totalMinutes / 60);
        const avgDailyHours = Number((totalHours / 5).toFixed(2));
        const completionRate = totalTasks === 0
            ? 0
            : Math.round((completedTasks / totalTasks) * 100);
        const productivityScore = Math.min(100, completionRate + Math.min(30, avgDailyHours * 5));
        await db_1.default.employeeReportSnapshot.upsert({
            where: {
                reportId_userId: {
                    reportId: report.id,
                    userId: user.id,
                },
            },
            update: {},
            create: {
                reportId: report.id,
                userId: user.id,
                tenantId: report.tenantId,
                totalTasks,
                completedTasks,
                todoTasks,
                workingTasks,
                doneTasks: completedTasks, // Alias for older schema maybe?
                completionRate,
                totalHours,
                avgDailyHours,
                productivityScore,
                fromDate: report.fromDate,
                toDate: report.toDate,
            },
        });
        await (0, reportPdfWorker_1.generateEmployeeReportPDF)(report.id, user.id);
    }
    // ----------------------------------
    // 4️⃣ Mark report READY
    // ----------------------------------
    await db_1.default.report.update({
        where: { id: report.id },
        data: { status: "READY" },
    });
    console.log(`Report ${reportId} generated successfully.`);
}, {
    connection: queue_1.connection,
    // Add logic to keep connection alive or restart on unexpected errors?
    autorun: true
});
// ----------------------------------
// 🔴 ERROR HANDLERS (Email Notification)
// ----------------------------------
reportWorker.on('failed', async (job, err) => {
    console.error(`Status: FAILED for Job ${job?.id} in ${workerName}`);
    console.error(err);
    // Special handling for "Missing lock" errors which happen after restarts
    if (err.message.includes("Missing lock")) {
        console.warn(`⚠️ Job ${job?.id} failed due to missing lock (likely Redis restart). The job might have actually completed.`);
        await (0, email_1.sendWorkerErrorEmail)(workerName, err, {
            jobId: job?.id,
            reason: "Lock lost during processing. Check if job completed or needs retry."
        });
    }
    else {
        await (0, email_1.sendWorkerErrorEmail)(workerName, err, job?.data);
    }
});
reportWorker.on('error', async (err) => {
    console.error(`Status: ERROR for Worker ${workerName}`);
    console.error(err);
    await (0, email_1.sendWorkerErrorEmail)(workerName, err, { context: "Worker Process Error" });
});
process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled Rejection at:', reason);
    await (0, email_1.sendWorkerErrorEmail)("Process", reason, { context: "Unhandled Rejection" });
});
process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    await (0, email_1.sendWorkerErrorEmail)("Process", err, { context: "Uncaught Exception" });
    // connection.quit(); // Optional: close connection
    process.exit(1);
});
exports.default = reportWorker;
//# sourceMappingURL=reportWorker.js.map