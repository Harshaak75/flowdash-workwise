import puppeteer from "puppeteer";
import prisma from "../db";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { buildEmployeeReportHTML } from "../templates/employeeReportTemplate";


const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import os from "os";

export async function generateEmployeeReportPDF(
    reportId: string,
    userId: string
) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    const snapshot = await prisma.employeeReportSnapshot.findUnique({
        where: { reportId_userId: { reportId, userId } },
    });

    if (!report || !snapshot) throw new Error("Invalid report");

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

    // Fill in gaps (optional, but looks better)
    const trendData: { date: string; count: number }[] = [];
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
    const html = buildEmployeeReportHTML(report, snapshot, trendData);

    // 2️⃣ Render PDF
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Use domcontentloaded to avoid timeouts if sticky connections or external assets hang
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 120000 });

    const tmpDir = os.tmpdir();
    const pdfPath = path.join(tmpDir, `${reportId}-${userId}.pdf`);
    await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true
    });

    await browser.close();

    // 3️⃣ Upload
    const storagePath = `${report.tenantId}/reports/${reportId}-${userId}.pdf`;

    await supabase.storage
        .from("reports")
        .upload(storagePath, fs.readFileSync(pdfPath), {
            contentType: "application/pdf",
            upsert: true,
        });

    const pdfUrl = supabase.storage
        .from("reports")
        .getPublicUrl(storagePath).data.publicUrl;

    await prisma.employeeReportSnapshot.update({
        where: {
            reportId_userId: { reportId, userId },
        },
        data: { pdfUrl },
    });

    return pdfUrl;
}
