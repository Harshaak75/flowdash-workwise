import { Router } from "express";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import prisma from "../db";
import { ensureFreshKeycloakToken } from "../middleware/validateKeycloakBeforeHRM";
import axios from "axios";
import { auth } from "../middleware/auth";
import { reportQueue } from "../lib/queue";

const router = Router();

router.post("/reports/generate", auth, async (req, res) => {
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

        const report = await prisma.report.create({
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
        await reportQueue.add("generate-report", {
            reportId: report.id,
        });

        return res.status(201).json({
            message: "Report generation started",
            reportId: report.id,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});


router.get("/reports", auth, async (req, res) => {
  try {
    const user = req.user;
    if(!user){
        return res.status(401).json({ message: "Unauthorized" });
    }

    const where: any = {
      tenantId: user.tenantId,
    };

    // Project managers should only see their own reports
    if (user.role === "PROJECT_MANAGER") {
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

    return res.json(
      reports.map((r) => ({
        id: r.id,
        title: `${r.type} Report`,
        type: r.type,
        status: r.status,
        fromDate: r.fromDate,
        toDate: r.toDate,
        pdfUrl: r.pdfUrl,
        excelUrl: r.excelUrl,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.get("/reports/summary", auth, async (req, res) => {
  try {
    const user = req.user;
    if(!user){
        return res.status(401).json({ message: "Unauthorized" });
    }

    // Total reports
    const totalReports = await prisma.report.count({
      where: { tenantId: user.tenantId },
    });

    // Team members (manager only)
    let teamMembers = 0;
    if (user.role === "MANAGER") {
      teamMembers = await prisma.user.count({
        where: { tenantId: user.tenantId },
      });
    }

    // Total hours (TaskWorkLog)
    const workLogs = await prisma.taskWorkLog.findMany({
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
      return (
        acc +
        (new Date(log.endTime!).getTime() -
          new Date(log.startTime).getTime()) /
          60000
      );
    }, 0);

    const totalHours = Math.round(totalMinutes / 60);

    // Completion rate
    const totalTasks = await prisma.task.count({
      where: { tenantId: user.tenantId, isDeleted: false },
    });

    const completedTasks = await prisma.task.count({
      where: {
        tenantId: user.tenantId,
        status: "DONE",
        isDeleted: false,
      },
    });

    const completionRate =
      totalTasks === 0
        ? 0
        : Math.round((completedTasks / totalTasks) * 100);

    return res.json({
      totalReports,
      teamMembers,
      totalHours,
      completionRate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});


export default router;