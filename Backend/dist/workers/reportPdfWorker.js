"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmployeeReportPDF = generateEmployeeReportPDF;
const puppeteer_1 = __importDefault(require("puppeteer"));
const db_1 = __importDefault(require("../db"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase_js_1 = require("@supabase/supabase-js");
const employeeReportTemplate_1 = require("../templates/employeeReportTemplate");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
const os_1 = __importDefault(require("os"));
async function generateEmployeeReportPDF(reportId, userId) {
    const report = await db_1.default.report.findUnique({ where: { id: reportId } });
    const snapshot = await db_1.default.employeeReportSnapshot.findUnique({
        where: { reportId_userId: { reportId, userId } },
    });
    if (!report || !snapshot)
        throw new Error("Invalid report");
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
    // Fill in gaps (optional, but looks better)
    const trendData = [];
    const currentDate = new Date(report.fromDate);
    // Safety check to avoid infinite loops if dates are messed up
    const endDate = new Date(report.toDate);
    // Limit to 365 days to prevent infinite loops on bad data
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
    // 2️⃣ Build HTML
    const html = (0, employeeReportTemplate_1.buildEmployeeReportHTML)(report, snapshot, trendData);
    // 2️⃣ Render PDF
    // 2️⃣ Render PDF
    const tmpProfilePath = path_1.default.join(os_1.default.tmpdir(), `puppeteer_profile_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    const tmpDir = os_1.default.tmpdir();
    const pdfPath = path_1.default.join(tmpDir, `${reportId}-${userId}.pdf`);
    let browser;
    try {
        browser = await puppeteer_1.default.launch({
            headless: true,
            userDataDir: tmpProfilePath, // Unique profile per request
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage" // Fixes some memory/crash issues
            ],
        });
        const page = await browser.newPage();
        // Use domcontentloaded to avoid timeouts if sticky connections or external assets hang
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 120000 });
        await page.pdf({
            path: pdfPath,
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true
        });
        // 3️⃣ Upload (Inside try to ensure file exists)
        const storagePath = `${report.tenantId}/reports/${reportId}-${userId}.pdf`;
        await supabase.storage
            .from("reports")
            .upload(storagePath, fs_1.default.readFileSync(pdfPath), {
            contentType: "application/pdf",
            upsert: true,
        });
        const pdfUrl = supabase.storage
            .from("reports")
            .getPublicUrl(storagePath).data.publicUrl;
        await db_1.default.employeeReportSnapshot.update({
            where: {
                reportId_userId: { reportId, userId },
            },
            data: { pdfUrl },
        });
        return pdfUrl;
    }
    finally {
        if (browser) {
            await browser.close();
        }
        // Cleanup PDF file
        try {
            if (fs_1.default.existsSync(pdfPath)) {
                fs_1.default.unlinkSync(pdfPath);
            }
        }
        catch (err) {
            console.error("Failed to delete temp PDF:", err);
        }
        // Cleanup temp profile dir
        try {
            if (fs_1.default.existsSync(tmpProfilePath)) {
                fs_1.default.rmSync(tmpProfilePath, { recursive: true, force: true });
            }
        }
        catch (cleanupErr) {
            console.error("Failed to clean up temp profile:", cleanupErr);
        }
    }
}
//# sourceMappingURL=reportPdfWorker.js.map