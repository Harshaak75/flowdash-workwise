import { Router } from "express";
import os from "os";
import prisma from "../db";
import { auth } from "../middleware/auth";
import fs from "fs";
import { buildEmployeeReportHTML } from "../templates/employeeReportTemplate";
import puppeteer from "puppeteer";
import path from "path";
import ExcelJS from "exceljs";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const router = Router();

async function canAccessEmployeeReport(
    requester: any,
    targetUserId: string,
    tenantId: string
) {
    if (requester.role === "PROJECT_MANAGER") return true;

    if (requester.role === "MANAGER") {
        const employee = await prisma.employee.findFirst({
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

const upload = multer({ storage: multer.memoryStorage() });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

router.get(
    "/:reportId/employee/:userId/pdf",
    auth,
    async (req, res) => {
        const { reportId, userId }: any = req.params;
        const user = req.user!;

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!userId && !reportId) {
            return res.status(400).json({ message: "User ID or Report ID is required" });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        const allowed = await canAccessEmployeeReport(
            user,
            userId,
            report.tenantId
        );

        if (!allowed) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const snapshot = await prisma.employeeReportSnapshot.findUnique({
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
        const tmpDir = os.tmpdir();
        const tmpPath = path.join(tmpDir, `${reportId}-${userId}.pdf`);

        // 1️⃣ Build Trend Data
        const completedTasks = await prisma.task.findMany({
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

        const trendMap: Record<string, number> = {};
        completedTasks.forEach((t) => {
            if (!t.completedAt) return;
            const date = t.completedAt.toISOString().split("T")[0]; // "YYYY-MM-DD"
            if (date) {
                trendMap[date] = (trendMap[date] || 0) + 1;
            }
        });

        // Fill in gaps
        const trendData: { date: string; count: number }[] = [];
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

        const html = buildEmployeeReportHTML(report, snapshot, trendData);

        const browser = await puppeteer.launch({
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
            .upload(storagePath, fs.readFileSync(tmpPath), {
                contentType: "application/pdf",
                upsert: true,
            });

        // Clean up temp file
        try {
            fs.unlinkSync(tmpPath);
        } catch (e) {
            console.error("Failed to delete temp file", e);
        }

        const pdfUrl = supabase.storage
            .from("reports")
            .getPublicUrl(storagePath).data.publicUrl;

        await prisma.employeeReportSnapshot.update({
            where: {
                reportId_userId: { reportId, userId },
            },
            data: { pdfUrl },
        });

        res.json({ url: pdfUrl });
    }
);


router.get(
    "/:reportId/employee/:userId/excel",
    auth,
    async (req, res) => {
        const { reportId, userId }: any = req.params;
        const user = req.user!;

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!userId && !reportId) {
            return res.status(400).json({ message: "User ID or Report ID is required" });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        const allowed = await canAccessEmployeeReport(
            user,
            userId,
            report.tenantId
        );

        if (!allowed) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (report.excelUrl) {
            return res.json({ url: report.excelUrl });
        }

        const snapshot = await prisma.employeeReportSnapshot.findUnique({
            where: {
                reportId_userId: { reportId, userId },
            },
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Performance");

        sheet.addRows([
            ["Total Tasks", snapshot!.totalTasks],
            ["Completed Tasks", snapshot!.completedTasks],
            ["Completion Rate", snapshot!.completionRate],
            ["Total Hours", snapshot!.totalHours],
            ["Avg Daily Hours", snapshot!.avgDailyHours],
            ["Productivity Score", snapshot!.productivityScore],
        ]);

        const tmpDir = os.tmpdir();
        const tmpPath = path.join(tmpDir, `${reportId}-${userId}.xlsx`);
        await workbook.xlsx.writeFile(tmpPath);

        const storagePath = `${report.tenantId}/reports/${reportId}-${userId}.xlsx`;

        await supabase.storage
            .from("reports")
            .upload(storagePath, fs.readFileSync(tmpPath), {
                contentType:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                upsert: true,
            });

        const excelUrl = supabase.storage
            .from("reports")
            .getPublicUrl(storagePath).data.publicUrl;

        await prisma.report.update({
            where: { id: reportId },
            data: { excelUrl },
        });

        res.json({ url: excelUrl });
    }
);

export default router;
