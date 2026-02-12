"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const os_1 = __importDefault(require("os"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const fs_1 = __importDefault(require("fs"));
const employeeReportTemplate_1 = require("../templates/employeeReportTemplate");
const puppeteer_1 = __importDefault(require("puppeteer"));
const path_1 = __importDefault(require("path"));
const exceljs_1 = __importDefault(require("exceljs"));
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("@supabase/supabase-js");
const router = (0, express_1.Router)();
async function canAccessEmployeeReport(requester, targetUserId, tenantId) {
    if (requester.role === "PROJECT_MANAGER")
        return true;
    if (requester.role === "MANAGER") {
        const employee = await db_1.default.employee.findFirst({
            where: {
                userId: targetUserId,
                tenantId,
                managerId: requester.id,
            },
        });
        return !!employee;
    }
    return false;
}
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
router.get("/:reportId/employee/:userId/pdf", auth_1.auth, async (req, res) => {
    const { reportId, userId } = req.params;
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (!userId && !reportId) {
        return res.status(400).json({ message: "User ID or Report ID is required" });
    }
    const report = await db_1.default.report.findUnique({
        where: { id: reportId },
    });
    if (!report) {
        return res.status(404).json({ message: "Report not found" });
    }
    const allowed = await canAccessEmployeeReport(user, userId, report.tenantId);
    if (!allowed) {
        return res.status(403).json({ message: "Forbidden" });
    }
    const snapshot = await db_1.default.employeeReportSnapshot.findUnique({
        where: {
            reportId_userId: { reportId, userId },
        },
    });
    if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
    }
    if (snapshot.pdfUrl && !req.query.regenerate) {
        return res.json({ url: snapshot.pdfUrl });
    }
    // Generate PDF using Puppeteer (for charts)
    const tmpDir = os_1.default.tmpdir();
    const tmpPath = path_1.default.join(tmpDir, `${reportId}-${userId}.pdf`);
    // 1️⃣ Build Trend Data
    const completedTasks = await db_1.default.task.findMany({
        where: {
            assigneeId: userId,
            status: "DONE",
            completedAt: {
                gte: report.fromDate,
                lte: report.toDate,
            },
        },
        select: { completedAt: true },
    });
    const trendMap = {};
    completedTasks.forEach((t) => {
        if (!t.completedAt)
            return;
        const date = t.completedAt.toISOString().split("T")[0]; // "YYYY-MM-DD"
        if (date) {
            trendMap[date] = (trendMap[date] || 0) + 1;
        }
    });
    // Fill in gaps
    const trendData = [];
    const currentDate = new Date(report.fromDate);
    const endDate = new Date(report.toDate);
    let safetyCounter = 0;
    while (currentDate <= endDate && safetyCounter < 365) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (dateStr) {
            trendData.push({
                date: dateStr,
                count: trendMap[dateStr] || 0,
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
        safetyCounter++;
    }
    const html = (0, employeeReportTemplate_1.buildEmployeeReportHTML)(report, snapshot, trendData);
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    // Wait for chart.js to render (networkidle2 is usually enough for CDN)
    await page.setContent(html, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
    });
    await page.pdf({
        path: tmpPath,
        format: "A4",
        printBackground: true,
    });
    await browser.close();
    const storagePath = `${report.tenantId}/reports/${reportId}-${userId}.pdf`;
    await supabase.storage
        .from("reports")
        .upload(storagePath, fs_1.default.readFileSync(tmpPath), {
        contentType: "application/pdf",
        upsert: true,
    });
    // Clean up temp file
    try {
        fs_1.default.unlinkSync(tmpPath);
    }
    catch (e) {
        console.error("Failed to delete temp file", e);
    }
    const pdfUrl = supabase.storage
        .from("reports")
        .getPublicUrl(storagePath).data.publicUrl;
    await db_1.default.employeeReportSnapshot.update({
        where: {
            reportId_userId: { reportId, userId },
        },
        data: { pdfUrl },
    });
    res.json({ url: pdfUrl });
});
router.get("/:reportId/employee/:userId/excel", auth_1.auth, async (req, res) => {
    const { reportId, userId } = req.params;
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (!userId && !reportId) {
        return res.status(400).json({ message: "User ID or Report ID is required" });
    }
    const report = await db_1.default.report.findUnique({
        where: { id: reportId },
    });
    if (!report) {
        return res.status(404).json({ message: "Report not found" });
    }
    const allowed = await canAccessEmployeeReport(user, userId, report.tenantId);
    if (!allowed) {
        return res.status(403).json({ message: "Forbidden" });
    }
    if (report.excelUrl) {
        return res.json({ url: report.excelUrl });
    }
    const snapshot = await db_1.default.employeeReportSnapshot.findUnique({
        where: {
            reportId_userId: { reportId, userId },
        },
    });
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet("Performance");
    sheet.addRows([
        ["Total Tasks", snapshot.totalTasks],
        ["Completed Tasks", snapshot.completedTasks],
        ["Completion Rate", snapshot.completionRate],
        ["Total Hours", snapshot.totalHours],
        ["Avg Daily Hours", snapshot.avgDailyHours],
        ["Productivity Score", snapshot.productivityScore],
    ]);
    const tmpDir = os_1.default.tmpdir();
    const tmpPath = path_1.default.join(tmpDir, `${reportId}-${userId}.xlsx`);
    await workbook.xlsx.writeFile(tmpPath);
    const storagePath = `${report.tenantId}/reports/${reportId}-${userId}.xlsx`;
    await supabase.storage
        .from("reports")
        .upload(storagePath, fs_1.default.readFileSync(tmpPath), {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
    });
    const excelUrl = supabase.storage
        .from("reports")
        .getPublicUrl(storagePath).data.publicUrl;
    await db_1.default.report.update({
        where: { id: reportId },
        data: { excelUrl },
    });
    res.json({ url: excelUrl });
});
exports.default = router;
//# sourceMappingURL=reportDownload.js.map