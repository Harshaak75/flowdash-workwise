"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const queue_1 = require("../lib/queue");
const router = (0, express_1.Router)();
router.post("/reports/generate", auth_1.auth, async (req, res) => {
    try {
        const { type, fromDate, toDate } = req.body;
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!type || !fromDate || !toDate) {
            return res.status(400).json({ message: "Missing fields" });
        }
        const scope = type === "EMPLOYEE" ? "EMPLOYEE" : "TEAM";
        const report = await db_1.default.report.create({
            data: {
                tenantId: user.tenantId,
                type,
                scope,
                generatedBy: user.id,
                fromDate: new Date(fromDate),
                toDate: new Date(toDate),
                status: "GENERATING",
            },
        });
        // ✅ enqueue async job
        await queue_1.reportQueue.add("generate-report", {
            reportId: report.id,
        });
        return res.status(201).json({
            message: "Report generation started",
            reportId: report.id,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});
router.get("/reports", auth_1.auth, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const where = {
            tenantId: user.tenantId,
        };
        // Project managers should only see their own reports
        if (user.role === "PROJECT_MANAGER") {
            where.generatedBy = user.id;
        }
        const reports = await db_1.default.report.findMany({
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
        return res.json(reports.map((r) => ({
            id: r.id,
            title: `${r.type} Report`,
            type: r.type,
            status: r.status,
            fromDate: r.fromDate,
            toDate: r.toDate,
            pdfUrl: r.pdfUrl,
            excelUrl: r.excelUrl,
        })));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});
router.get("/reports/summary", auth_1.auth, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        // Total reports
        const totalReports = await db_1.default.report.count({
            where: { tenantId: user.tenantId },
        });
        // Team members (manager only)
        let teamMembers = 0;
        if (user.role === "MANAGER") {
            teamMembers = await db_1.default.user.count({
                where: { tenantId: user.tenantId },
            });
        }
        // Total hours (TaskWorkLog)
        const workLogs = await db_1.default.taskWorkLog.findMany({
            where: {
                user: { tenantId: user.tenantId },
                endTime: { not: null },
            },
            select: {
                startTime: true,
                endTime: true,
            },
        });
        const totalMinutes = workLogs.reduce((acc, log) => {
            return (acc +
                (new Date(log.endTime).getTime() -
                    new Date(log.startTime).getTime()) /
                    60000);
        }, 0);
        const totalHours = Math.round(totalMinutes / 60);
        // Completion rate
        const totalTasks = await db_1.default.task.count({
            where: { tenantId: user.tenantId, isDeleted: false },
        });
        const completedTasks = await db_1.default.task.count({
            where: {
                tenantId: user.tenantId,
                status: "DONE",
                isDeleted: false,
            },
        });
        const completionRate = totalTasks === 0
            ? 0
            : Math.round((completedTasks / totalTasks) * 100);
        return res.json({
            totalReports,
            teamMembers,
            totalHours,
            completionRate,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=report.js.map