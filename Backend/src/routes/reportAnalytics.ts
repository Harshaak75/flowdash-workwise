import { Router } from "express";
import prisma from "../db";
import { auth } from "../middleware/auth";
import redis from "../lib/redis";
import { buildTeamReportHTML } from "../templates/teamReportTemplate";
import puppeteer from "puppeteer";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import os from "os";

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

router.get(
    "/:reportId/employee/:userId/summary",
    auth,
    async (req, res) => {
        const { reportId, userId } = req.params;
        const user: any = req.user!;

        if (!reportId) {
            return res.status(400).json({ message: "Report ID is required" });
        }

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const report: any = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report || report.tenantId !== user.tenantId) {
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

        // ⚡ Redis cache
        const cacheKey = `report:${reportId}:user:${userId}:summary`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const snapshot = await prisma.employeeReportSnapshot.findUnique({
            where: {
                reportId_userId: { reportId, userId },
            },
        });

        if (!snapshot) {
            return res.status(404).json({ message: "Snapshot not found" });
        }

        const response = {
            totalTasks: snapshot.totalTasks,
            completedTasks: snapshot.completedTasks,
            pendingTasks: snapshot.totalTasks - snapshot.completedTasks,
            completionRate: snapshot.completionRate,
            totalHours: snapshot.totalHours,
            avgDailyHours: snapshot.avgDailyHours,
            productivityScore: snapshot.productivityScore,
        };

        // 🧠 Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(response));

        res.json(response);
    }
);

router.get(
    "/:reportId/employee/:userId/hours",
    auth,
    async (req, res) => {
        const { reportId, userId } = req.params;
        const user = req.user!;

        if (!reportId) {
            return res.status(400).json({ message: "Report ID is required" });
        }

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
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

        const logs = await prisma.taskWorkLog.findMany({
            where: {
                userId,
                user: { tenantId: report.tenantId },
                startTime: {
                    gte: report.fromDate,
                    lte: report.toDate,
                },
                endTime: { not: null },
            },
        });

        const grouped: Record<string, number> = {};

        logs.forEach((l) => {
            const date = l.startTime.toISOString().slice(0, 10);
            const hours =
                (l.endTime!.getTime() - l.startTime.getTime()) / 3600000;
            grouped[date] = (grouped[date] || 0) + hours;
        });

        res.json(
            Object.entries(grouped).map(([date, hours]) => ({
                date,
                hours: Number(hours.toFixed(2)),
            }))
        );
    }
);

router.get(
    "/:reportId/employee/:userId/productivity-trend",
    auth,
    async (req, res) => {
        const { reportId, userId } = req.params;

        if (!reportId) {
            return res.status(400).json({ message: "Report ID is required" });
        }

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        const allowed = await canAccessEmployeeReport(
            req.user!,
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

        // Simple weekly trend placeholder (can evolve)
        res.json([
            { week: "W1", score: Math.max(40, snapshot.productivityScore - 20) },
            { week: "W2", score: Math.max(50, snapshot.productivityScore - 10) },
            { week: "W3", score: snapshot.productivityScore },
        ]);
    }
);

router.get(
    "/:reportId/employee/:userId/tasks-distribution",
    auth,
    async (req, res) => {
        const { reportId, userId } = req.params;

        if (!reportId) {
            return res.status(400).json({ message: "Report ID is required" });
        }

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        const allowed = await canAccessEmployeeReport(
            req.user!,
            userId,
            report.tenantId
        );

        if (!allowed) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const snapshot = await prisma.employeeReportSnapshot.findUnique({
            where: {
                reportId_userId: {
                    reportId,
                    userId,
                },
            },
        });

        if (!snapshot) {
            return res.status(404).json({ message: "Snapshot not found" });
        }

        res.json({
            todo: snapshot.todoTasks,
            working: snapshot.workingTasks,
            done: snapshot.doneTasks,
        });
    }
);

router.get(
    "/:reportId/employee/:userId/priority-distribution",
    auth,
    async (req, res) => {
        const { reportId, userId } = req.params;
        const user = req.user!;

        if (!reportId) {
            return res.status(400).json({ message: "Report ID is required" });
        }

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
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

        const tasks = await prisma.task.findMany({
            where: {
                assigneeId: userId,
                tenantId: report.tenantId,
                createdAt: {
                    gte: report.fromDate,
                    lte: report.toDate,
                },
            },
        });

        const result = { HIGH: 0, MEDIUM: 0, LOW: 0 };
        tasks.forEach((t) => result[t.priority]++);

        res.json(result);
    }
);

router.get(
    "/:reportId/employee/:userId/efficiency",
    auth,
    async (req, res) => {
        const { reportId, userId } = req.params;

        if (!reportId) {
            return res.status(400).json({ message: "Report ID is required" });
        }

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        const allowed = await canAccessEmployeeReport(
            req.user!,
            userId,
            report.tenantId
        );

        if (!allowed) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const snapshot = await prisma.employeeReportSnapshot.findUnique({
            where: {
                reportId_userId: {
                    reportId,
                    userId,
                },
            },
        });

        if (!snapshot) {
            return res.status(404).json({ message: "Snapshot not found" });
        }

        res.json({
            speed: Math.min(100, snapshot!.avgDailyHours * 10),
            quality: snapshot!.completionRate,
            consistency: Math.min(100, snapshot!.totalTasks * 5),
            timeManagement: Math.max(40, 100 - snapshot!.avgDailyHours * 8),
            activity: Math.min(100, snapshot!.totalHours * 2),
        });
    }
);


router.get(
    "/:reportId/employee/:userId/insights",
    auth,
    async (req, res) => {
        const { reportId, userId } = req.params;

        if (!reportId) {
            return res.status(400).json({ message: "Report ID is required" });
        }

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        const allowed = await canAccessEmployeeReport(
            req.user!,
            userId,
            report.tenantId
        );

        if (!allowed) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const snapshot = await prisma.employeeReportSnapshot.findUnique({
            where: {
                reportId_userId: {
                    reportId,
                    userId,
                },
            },
        });

        if (!snapshot) {
            return res.status(404).json({ message: "Snapshot not found" });
        }

        const insights: string[] = [];

        if (snapshot!.completionRate > 80)
            insights.push("High task completion rate");

        if (snapshot!.avgDailyHours > 9)
            insights.push("Potential overworking detected");

        if (snapshot!.productivityScore < 60)
            insights.push("Productivity improvement required");

        if (insights.length === 0)
            insights.push("Performance is stable");

        res.json(insights);
    }
);


router.get("/filter", auth, async (req, res) => {
    const user = req.user!;
    const { type, from, to } = req.query;

    const where: any = {
        tenantId: user.tenantId,
    };

    if (type) where.type = type;

    if (from && to) {
        where.createdAt = {
            gte: new Date(from as string),
            lte: new Date(to as string),
        };
    }

    // MANAGER → only own reports
    if (user.role === "MANAGER") {
        where.generatedBy = user.id;
    }

    const reports = await prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            type: true,
            scope: true,
            status: true,
            fromDate: true,
            toDate: true,
            pdfUrl: true,
            excelUrl: true,
            createdAt: true,
        },
    });

    res.json(reports);
});

router.get(
    "/:reportId/team/pdf",
    auth,
    async (req, res) => {
        const { reportId }: any = req.params;
        const user = req.user!;

        if (user.role === "OPERATOR") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report || report.tenantId !== user.tenantId) {
            return res.status(404).json({ message: "Report not found" });
        }

        // 🔁 Return existing team PDF if already generated
        if (report.pdfUrl && !req.query.regenerate) {
            return res.json({ url: report.pdfUrl });
        }

        let snapshots;

        // PROJECT_MANAGER → all users
        if (user.role === "PROJECT_MANAGER") {
            snapshots = await prisma.employeeReportSnapshot.findMany({
                where: { reportId },
                include: { user: true },
            });
        }

        // MANAGER → only their employees
        if (user.role === "MANAGER") {
            snapshots = await prisma.employeeReportSnapshot.findMany({
                where: {
                    reportId,
                    user: {
                        Employee: {
                            managerId: user.id,
                        },
                    },
                },
                include: { user: true },
            });
        }

        if (!snapshots || snapshots.length === 0) {
            return res.status(404).json({ message: "No data for team report" });
        }

        // ----------------------------------
        // 4️⃣ Aggregate TEAM metrics
        // ----------------------------------
        const teamMetrics = {
            totalTasks: 0,
            completedTasks: 0,
            totalHours: 0,
            avgProductivity: 0,
        };

        const userIds = snapshots.map(s => s.userId);

        snapshots.forEach((s) => {
            teamMetrics.totalTasks += s.totalTasks;
            teamMetrics.completedTasks += s.completedTasks;
            teamMetrics.totalHours += s.totalHours;
            teamMetrics.avgProductivity += s.productivityScore;
        });

        teamMetrics.avgProductivity = Math.round(
            teamMetrics.avgProductivity / snapshots.length
        );

        // ----------------------------------
        // 4.5️⃣ Aggregate TREND metrics (New)
        // ----------------------------------
        const allCompletedTasks = await prisma.task.findMany({
            where: {
                assigneeId: { in: userIds },
                status: "DONE",
                completedAt: {
                    gte: report.fromDate,
                    lte: report.toDate,
                },
            },
            select: { completedAt: true },
        });

        const trendMap: Record<string, number> = {};
        allCompletedTasks.forEach((t) => {
            if (!t.completedAt) return;
            const date: any = t.completedAt.toISOString().split("T")[0];
            trendMap[date] = (trendMap[date] || 0) + 1;
        });

        const trendData: { date: string; count: number }[] = [];
        const currentDate = new Date(report.fromDate);
        const endDate = new Date(report.toDate);

        let safetyCounter = 0;
        // Limit loop to 365 days
        while (currentDate <= endDate && safetyCounter < 365) {
            const dateStr: any = currentDate.toISOString().split("T")[0];
            trendData.push({
                date: dateStr,
                count: trendMap[dateStr] || 0,
            });
            currentDate.setDate(currentDate.getDate() + 1);
            safetyCounter++;
        }

        // ----------------------------------
        // 5️⃣ Build TEAM HTML
        // ----------------------------------
        const html = buildTeamReportHTML(report, teamMetrics, snapshots, trendData);

        // ----------------------------------
        // 6️⃣ Render PDF
        // ----------------------------------
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: "domcontentloaded",
            timeout: 120000,
        });

        const tmpDir = os.tmpdir();
        const pdfPath = path.join(tmpDir, `${reportId}-team.pdf`);
        await page.pdf({
            path: pdfPath,
            format: "A4",
            printBackground: true,
        });

        await browser.close();

        // ----------------------------------
        // 7️⃣ Upload
        // ----------------------------------
        const storagePath = `${report.tenantId}/reports/${reportId}-team.pdf`;

        await supabase.storage
            .from("reports")
            .upload(storagePath, fs.readFileSync(pdfPath), {
                contentType: "application/pdf",
                upsert: true,
            });

        const pdfUrl = supabase.storage
            .from("reports")
            .getPublicUrl(storagePath).data.publicUrl;

        await prisma.report.update({
            where: { id: reportId },
            data: { pdfUrl },
        });

        res.json({ url: pdfUrl });
    }
);

export default router;