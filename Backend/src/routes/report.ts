import { Router } from "express";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import prisma from "../db";
import { ensureFreshKeycloakToken } from "../middleware/validateKeycloakBeforeHRM";
import axios from "axios";
import { auth } from "../middleware/auth";
import { reportQueue } from "../lib/queue";

const router = Router();

// router.post("/reports/generate", auth, async (req, res) => {
//     try {
//         const { type, fromDate, toDate } = req.body;
//         const user = req.user;
//         if (!user) {
//             return res.status(401).json({ message: "Unauthorized" });
//         }

//         if (!type || !fromDate || !toDate) {
//             return res.status(400).json({ message: "Missing fields" });
//         }

//         const scope = type === "EMPLOYEE" ? "EMPLOYEE" : "TEAM";

//         const report = await prisma.report.create({
//             data: {
//                 tenantId: user.tenantId,
//                 type,
//                 scope,
//                 generatedBy: user.id,
//                 fromDate: new Date(fromDate),
//                 toDate: new Date(toDate),
//                 status: "GENERATING",
//             },
//         });

//         // ✅ enqueue async job
//         await reportQueue.add("generate-report", {
//             reportId: report.id,
//         });

//         return res.status(201).json({
//             message: "Report generation started",
//             reportId: report.id,
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });

router.post("/reports/generate", auth, async (req, res) => {
  const { type, scope, fromDate, toDate, employeeIds } = req.body;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!type || !scope || !fromDate || !toDate) {
    return res.status(400).json({ message: "Missing fields" });
  }

  if (scope === "EMPLOYEE" && (!employeeIds || employeeIds.length === 0)) {
    return res.status(400).json({ message: "Employee IDs required" });
  }

  const report = await prisma.report.create({
    data: {
      tenantId: user.tenantId,
      type,
      scope,
      generatedBy: user.id,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
    },
  });

  await reportQueue.add("generate-report", {
    reportId: report.id,
    scope,
    employeeIds,
  });

  res.json({ reportId: report.id });
});


router.get("/reports", auth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
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
    if (!user) {
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


router.get("/search", auth, async (req, res) => {
  console.log("hiii")
  const user = req.user!;
  const search = (req.query.search as string) || "";
  console.log("users: ", user)
  console.log("search: ", search)

  if (user.role === "OPERATOR") {
    return res.status(403).json({ message: "Forbidden" });
  }

  let users;

  // PROJECT MANAGER → all managers + employees
  if (user.role === "PROJECT_MANAGER") {
    users = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        role: { in: ["MANAGER", "OPERATOR"] },
        email: { contains: search, mode: "insensitive" },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }

  // MANAGER → only their employees
  if (user.role === "MANAGER") {
    users = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        role: "OPERATOR",
        Employee: {
          managerId: user.id,
        },
        email: { contains: search, mode: "insensitive" },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }

  res.json(users);
});

export default router;