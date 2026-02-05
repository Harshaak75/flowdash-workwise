"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const queue_1 = require("../lib/queue");
const pdfkit_1 = __importDefault(require("pdfkit"));
const exceljs_1 = __importDefault(require("exceljs"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = __importDefault(require("../db"));
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("@supabase/supabase-js");
const os_1 = __importDefault(require("os"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const tmpDir = os_1.default.tmpdir(); // platform-safe
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
new bullmq_1.Worker("report-generation", async (job) => {
    const { reportId } = job.data;
    const report = await db_1.default.report.findUnique({
        where: { id: reportId },
    });
    if (!report)
        throw new Error("Report not found");
    // 1️⃣ Aggregate data (example: hours + tasks)
    const workLogs = await db_1.default.taskWorkLog.findMany({
        where: {
            user: { tenantId: report.tenantId },
            startTime: { gte: report.fromDate },
            endTime: { lte: report.toDate },
        },
        include: { user: true },
    });
    const rows = workLogs.map((l) => ({
        user: l.user.email,
        hours: ((l.endTime.getTime() - l.startTime.getTime()) / 3600000).toFixed(2),
    }));
    // 2️⃣ Generate PDF
    const pdfPath = path_1.default.join(tmpDir, `${report.id}.pdf`);
    const pdf = new pdfkit_1.default();
    pdf.pipe(fs_1.default.createWriteStream(pdfPath));
    pdf.text(`${report.type} Report`, { align: "center" });
    rows.forEach((r) => pdf.text(`${r.user} - ${r.hours} hrs`));
    pdf.end();
    // 3️⃣ Generate Excel
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.columns = [
        { header: "Employee", key: "user" },
        { header: "Hours Worked", key: "hours" },
    ];
    sheet.addRows(rows);
    const excelPath = path_1.default.join(tmpDir, `${report.id}.xlsx`);
    await workbook.xlsx.writeFile(excelPath);
    // 4️⃣ Upload to Supabase
    const year = report.createdAt.getFullYear();
    const month = String(report.createdAt.getMonth() + 1).padStart(2, "0");
    const basePath = `${report.tenantId}/${year}/${month}/${report.type}`;
    const pdfUpload = await supabase.storage
        .from("reports")
        .upload(`${basePath}/${report.id}.pdf`, fs_1.default.readFileSync(pdfPath), {
        contentType: "application/pdf",
        upsert: true,
    });
    const excelUpload = await supabase.storage
        .from("reports")
        .upload(`${basePath}/${report.id}.xlsx`, fs_1.default.readFileSync(excelPath), {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
    });
    const pdfUrl = supabase.storage
        .from("reports")
        .getPublicUrl(pdfUpload.data.path).data.publicUrl;
    const excelUrl = supabase.storage
        .from("reports")
        .getPublicUrl(excelUpload.data.path).data.publicUrl;
    // 5️⃣ Update report
    await db_1.default.report.update({
        where: { id: report.id },
        data: {
            status: "READY",
            pdfUrl,
            excelUrl,
        },
    });
    fs_1.default.unlinkSync(pdfPath);
    fs_1.default.unlinkSync(excelPath);
}, { connection: queue_1.connection });
//# sourceMappingURL=reportWorker.js.map