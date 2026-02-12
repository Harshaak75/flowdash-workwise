"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const queue_1 = require("../lib/queue");
const db_1 = __importDefault(require("../db"));
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("@supabase/supabase-js");
const os_1 = __importDefault(require("os"));
const reportPdfWorker_1 = require("./reportPdfWorker");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const tmpDir = os_1.default.tmpdir(); // platform-safe
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
// new Worker(
//   "report-generation",
//   async (job) => {
//     const { reportId } = job.data;
//     const report = await prisma.report.findUnique({
//       where: { id: reportId },
//     });
//     if (!report) throw new Error("Report not found");
//     // 1️⃣ Aggregate data (example: hours + tasks)
//     const workLogs = await prisma.taskWorkLog.findMany({
//       where: {
//         user: { tenantId: report.tenantId },
//         startTime: { gte: report.fromDate },
//         endTime: { lte: report.toDate },
//       },
//       include: { user: true },
//     });
//     const rows = workLogs.map((l) => ({
//       user: l.user.email,
//       hours:
//         ((l.endTime!.getTime() - l.startTime.getTime()) / 3600000).toFixed(2),
//     }));
//     // 2️⃣ Generate PDF
//     const pdfPath = path.join(tmpDir, `${report.id}.pdf`);
//     const pdf = new PDFDocument();
//     pdf.pipe(fs.createWriteStream(pdfPath));
//     pdf.text(`${report.type} Report`, { align: "center" });
//     rows.forEach((r) => pdf.text(`${r.user} - ${r.hours} hrs`));
//     pdf.end();
//     // 3️⃣ Generate Excel
//     const workbook = new ExcelJS.Workbook();
//     const sheet = workbook.addWorksheet("Report");
//     sheet.columns = [
//       { header: "Employee", key: "user" },
//       { header: "Hours Worked", key: "hours" },
//     ];
//     sheet.addRows(rows);
//     const excelPath = path.join(tmpDir, `${report.id}.xlsx`);
//     await workbook.xlsx.writeFile(excelPath);
//     // 4️⃣ Upload to Supabase
//     const year = report.createdAt.getFullYear();
//     const month = String(report.createdAt.getMonth() + 1).padStart(2, "0");
//     const basePath = `${report.tenantId}/${year}/${month}/${report.type}`;
//     const pdfUpload = await supabase.storage
//       .from("reports")
//       .upload(`${basePath}/${report.id}.pdf`, fs.readFileSync(pdfPath), {
//         contentType: "application/pdf",
//         upsert: true,
//       });
//     const excelUpload = await supabase.storage
//       .from("reports")
//       .upload(`${basePath}/${report.id}.xlsx`, fs.readFileSync(excelPath), {
//         contentType:
//           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//         upsert: true,
//       });
//     const pdfUrl = supabase.storage
//       .from("reports")
//       .getPublicUrl(pdfUpload.data!.path).data.publicUrl;
//     const excelUrl = supabase.storage
//       .from("reports")
//       .getPublicUrl(excelUpload.data!.path).data.publicUrl;
//     // 5️⃣ Update report
//     await prisma.report.update({
//       where: { id: report.id },
//       data: {
//         status: "READY",
//         pdfUrl,
//         excelUrl,
//       },
//     });
//     fs.unlinkSync(pdfPath);
//     fs.unlinkSync(excelPath);
//   },
//   { connection }
// );
new bullmq_1.Worker("report-generation", async (job) => {
    const { reportId, scope, employeeIds } = job.data;
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
                doneTasks: completedTasks,
                completionRate,
                totalHours,
                avgDailyHours,
                productivityScore,
                fromDate: report.fromDate,
                toDate: report.toDate,
            },
        });
        (0, reportPdfWorker_1.generateEmployeeReportPDF)(report.id, user.id);
    }
    // ----------------------------------
    // 4️⃣ Mark report READY
    // ----------------------------------
    await db_1.default.report.update({
        where: { id: report.id },
        data: { status: "READY" },
    });
}, { connection: queue_1.connection });
//# sourceMappingURL=reportWorker.js.map