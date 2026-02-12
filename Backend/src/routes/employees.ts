import { Router } from "express";
import { requireRole } from "../middleware/role.js";
import { auth } from "../middleware/auth.js";
import prisma from "../db";
import { requireAuth } from "../middleware/requireAuth.js";
import { kcAssignRealmRole, kcCreateUser } from "../auth/kc-users.js";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  subDays,
  format,
  isSameDay,
  startOfMonth,
  subMonths,
  endOfMonth,
} from "date-fns";

const router = Router();

// GET all employees (manager)

function subtractBreakMinutes(
  workMinutes: number,
  breakMinutes: number
) {
  return Math.max(0, workMinutes - breakMinutes);
}

function resolveDateRange(query: any) {
  const now = new Date();

  if (query.from && query.to) {
    return {
      from: new Date(query.from),
      to: new Date(query.to),
    };
  }

  switch (query.range) {
    case "7d":
      return { from: subDays(now, 7), to: now };

    case "14d":
      return { from: subDays(now, 14), to: now };

    case "30d":
      return { from: subDays(now, 30), to: now };

    case "month":
      return { from: startOfMonth(now), to: now };

    case "last_month":
      const lastMonth = subMonths(now, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };

    case "all":
      return { from: null, to: now };

    default:
      return { from: subDays(now, 7), to: now };
  }
}


const employeeInclude = (tenantId: string) => ({
  user: {
    select: {
      id: true,
      email: true,
      tasksAssigned: {
        where: {
          tenantId,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          fileUrl_manager: true,
          fileUrl_operator: true,
        },
      },
    },
  },
});

const employeePerformanceInclude = () => ({
  user: {
    select: {
      id: true,
      email: true,
      tasksAssigned: {
        where: {
          isDeleted: false,
        },
        select: {
          id: true,
          status: true,
        },
      },
    },
  },
});

const getTodayDate = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

// Get employees assigned to the logged-in manager
router.get(
  "/employees",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    const { id: userId, tenantId, role } = req.user!;

    try {
      let employees;

      if (role === "MANAGER") {
        // ✅ Manager sees operators (existing behavior)
        employees = await prisma.employee.findMany({
          where: {
            tenantId,
            managerId: userId,
          },
          include: employeeInclude(tenantId),
        });
      } else {
        // ✅ Project Manager sees ONLY managers
        employees = await prisma.employee.findMany({
          where: {
            tenantId,
            roleTitle: "MANAGER",
          },
          include: employeeInclude(tenantId),
        });
      }

      let taskCompletedCount = 0;

      const formattedEmployees = employees.map((emp) => {
        const tasks = emp.user.tasksAssigned.map((task) => {
          if (task.status === "DONE") taskCompletedCount++;

          return {
            id: task.id,
            title: task.title,
            status: task.status === "DONE" ? "Done" : task.status,
            priority: task.priority,
            dueDate: task.dueDate
              ? task.dueDate.toISOString().split("T")[0]
              : null,
            fileUrl_manager: task.fileUrl_manager,
            fileUrl_operator: task.fileUrl_operator,
          };
        });

        return {
          id: emp.id,
          name: emp.name,
          role: emp.roleTitle,
          email: emp.user.email,
          tasks,
        };
      });

      res.json({
        employees: formattedEmployees,
        taskCompletedCount,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  }
);

router.post(
  "/create",
  requireAuth,
  async (req, res) => {
    try {
      const { email, name, roleTitle, department, role } = req.body;

      const tenantId = req.user!.tenantId;
      const creatorRole = req.user!.role;

      // 🔐 Only managers can create employees
      if (!["MANAGER", "PROJECT_MANAGER"].includes(creatorRole)) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // 🔍 Prevent duplicate employee in SAME tenant
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          tenantId,
        },
      });

      if (existingUser) {
        return res
          .status(409)
          .json({ error: "Employee already exists in this tenant" });
      }

      // 1️⃣ Create user in Keycloak
      const kcUser = await kcCreateUser({
        email,
        firstName: name,
        tempPassword: "Temp@123",
      });

      await kcAssignRealmRole(kcUser.id, role);

      // 2️⃣ Create User (TENANT-AWARE)
      const user = await prisma.user.create({
        data: {
          email,
          password: "",
          role,
          tenantId, // 🔐 REQUIRED
        },
      });

      // 3️⃣ Create Employee profile
      await prisma.employee.create({
        data: {
          userId: user.id,
          name,
          roleTitle,
          department,
          tenantId, // 🔐 REQUIRED
        },
      });

      // 4️⃣ Link External Identity (TENANT-AWARE)
      await prisma.externalIdentity.create({
        data: {
          provider: "keycloak",
          subject: kcUser.id,
          email,
          tenantId, // 🔐 REQUIRED
          userId: user.id,
        },
      });

      res.json({
        success: true,
        message: "Employee created successfully",
      });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
);

router.get(
  "/dashboard",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const managerId = req.user!.id;
      const tenantId = req.user!.tenantId;

      // ----------------------------
      // EMPLOYEE STATS (TENANT SAFE)
      // ----------------------------
      const totalEmployees = await prisma.employee.count({
        where: { managerId, user: { tenantId } },
      });

      const activeEmployees = await prisma.employee.count({
        where: {
          managerId,
          status: "Active",
          user: { tenantId },
        },
      });

      // ----------------------------
      // TASK STATS (TENANT SAFE)
      // ----------------------------
      const totalTasks = await prisma.task.count({
        where: { createdById: managerId, tenantId },
      });

      const completedTasks = await prisma.task.count({
        where: {
          createdById: managerId,
          status: "DONE",
          tenantId,
        },
      });

      const completionRate =
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0;

      // ----------------------------
      // WEEKLY HOURS (LAST 7 DAYS)
      // ----------------------------
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

      const weeklyTasks = await prisma.task.findMany({
        where: {
          createdById: managerId,
          tenantId,
          dueDate: { gte: oneWeekAgo },
          assignedHours: { not: null },
        },
        select: { dueDate: true, assignedHours: true },
      });

      const weeklyData: { day: string; hours: number }[] = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(oneWeekAgo);
        date.setDate(oneWeekAgo.getDate() + i);

        const dayStr = date.toLocaleDateString("en-US", {
          weekday: "short",
        });

        const hours = weeklyTasks
          .filter(
            (t) =>
              t.dueDate &&
              t.dueDate.toDateString() === date.toDateString()
          )
          .reduce((sum, t) => sum + (t.assignedHours || 0), 0);

        weeklyData.push({ day: dayStr, hours });
      }

      // ----------------------------
      // PERFORMANCE TREND (4 WEEKS)
      // ----------------------------
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const trendTasks = await prisma.task.findMany({
        where: {
          createdById: managerId,
          tenantId,
          dueDate: { gte: fourWeeksAgo },
        },
        select: { dueDate: true, status: true },
      });

      const performanceData: { week: string; completion: number }[] = [];

      for (let w = 0; w < 4; w++) {
        const start = new Date(fourWeeksAgo);
        start.setDate(fourWeeksAgo.getDate() + w * 7);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const weekTasks = trendTasks.filter(
          (t) =>
            t.dueDate &&
            t.dueDate >= start &&
            t.dueDate <= end
        );

        const doneCount = weekTasks.filter(
          (t) => t.status === "DONE"
        ).length;

        const completion =
          weekTasks.length > 0
            ? Math.round((doneCount / weekTasks.length) * 100)
            : 0;

        performanceData.push({
          week: `Week ${w + 1}`,
          completion,
        });
      }

      // ----------------------------
      // TEAM OVERVIEW (TENANT SAFE)
      // ----------------------------
      const employees: any = await prisma.employee.findMany({
        where: {
          managerId,
          user: { tenantId },
        },
        include: {
          user: {
            include: {
              tasksAssigned: {
                where: { tenantId },
              },
            },
          },
        },
      });

      const teamOverview = await Promise.all(
        employees.map(async (emp: any) => {
          const tasks = emp.user?.tasksAssigned || [];
          const tasksCompleted = tasks.filter(
            (t: any) => t.status === "DONE"
          ).length;

          const { from, to } = resolveDateRange(req.query);

          const logs = await prisma.taskWorkLog.findMany({
            where: {
              userId: emp.user.id,
              startTime: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
              task: { tenantId },
            },
          });

          const totalActualMinutes = logs.reduce((sum, log) => {
            if (!log.endTime) return sum;
            return sum + (log.endTime.getTime() - log.startTime.getTime()) / 60000;
          }, 0);

          const workedDates = new Set(
            logs
              .filter(l => l.endTime)
              .map(l => l.startTime.toISOString().split("T")[0])
          );

          const breakMinutes = await prisma.userAttendance.aggregate({
            _sum: { totalBreakMinutes: true },
            where: {
              userId: emp.user.id,
              workDate: {
                in: Array.from(workedDates).map(d => new Date(d as string)),
              },
            },
          });

          const netActualMinutes = subtractBreakMinutes(
            totalActualMinutes,
            breakMinutes._sum.totalBreakMinutes || 0
          );

          const totalHours = Math.round((netActualMinutes / 60) * 10) / 10;

          const efficiency =
            tasks.length > 0
              ? Math.round((tasksCompleted / tasks.length) * 100)
              : 0;

          return {
            id: emp.id,
            name: emp.name ?? "Unknown",
            role: emp.roleTitle ?? "Staff",
            status: emp.status,
            tasksCompleted,
            hoursLogged: totalHours,
            efficiency,
          };
        })
      );
      const totalWeeklyHours = weeklyData.reduce(
        (sum, d) => sum + d.hours,
        0
      );

      // ----------------------------
      // RESPONSE
      // ----------------------------
      res.json({
        totalEmployees,
        activeEmployees,
        totalWeeklyHours,
        totalTasks,
        completionRate,
        weeklyData,
        performanceData,
        teamOverview,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Dashboard fetch failed" });
    }
  }
);

router.get(
  "/me",
  auth,
  requireRole("OPERATOR"),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;

      const me = await prisma.employee.findFirst({
        where: {
          userId,
          user: {
            tenantId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              tenantId: true,
            },
          },
        },
      });

      if (!me) {
        return res
          .status(404)
          .json({ error: "Employee not found for this tenant" });
      }

      res.json(me);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  }
);

// Create employee + user (manager)
router.post(
  "/",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const { email, password, name, roleTitle, department } = req.body;

      if (!email || !password || !name) {
        return res
          .status(400)
          .json({ error: "email, password, name required" });
      }

      const managerId = req.user!.id;
      const tenantId = req.user!.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context missing" });
      }

      // 1️⃣ Prevent duplicate user in SAME tenant
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          tenantId,
        },
      });

      if (existingUser) {
        return res
          .status(409)
          .json({ error: "User already exists in this tenant" });
      }

      // 2️⃣ Hash password
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash(
        password,
        Number(process.env.BCRYPT_ROUNDS) || 10
      );

      // 3️⃣ Create user WITH tenantId
      const user = await prisma.user.create({
        data: {
          email,
          password: hash,
          role: "OPERATOR",
          tenantId,
        },
      });

      // 4️⃣ Create employee under SAME tenant & manager
      const employee = await prisma.employee.create({
        data: {
          userId: user.id,
          name,
          roleTitle: roleTitle ?? "Operator",
          department,
          managerId,
          tenantId
        },
      });

      res.status(201).json({
        employee,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  }
);

// performace
router.get(
  "/performance",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const { id: userId, tenantId, role } = req.user!;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context missing" });
      }

      let employees;

      // -------------------------------
      // ROLE-BASED DATA FETCHING
      // -------------------------------
      if (role === "MANAGER") {
        // MANAGER → sees employees under them
        employees = await prisma.employee.findMany({
          where: {
            tenantId,
            managerId: userId,
          },
          include: employeePerformanceInclude(),
        });
      } else {
        // PROJECT_MANAGER → sees managers only
        employees = await prisma.employee.findMany({
          where: {
            tenantId,
            user: {
              role: "MANAGER",
            },
          },
          include: employeePerformanceInclude(),
        });
      }

      // -------------------------------
      // FORMAT RESPONSE
      // -------------------------------
      const formatted = employees.map((emp) => {
        const tasks = emp.user.tasksAssigned;

        const completedTasks = tasks.filter(
          (t) => t.status === "DONE"
        ).length;

        return {
          id: emp.id,
          name: emp.name,
          roleTitle: emp.roleTitle,
          email: emp.user.email,
          department: emp.department,
          status: emp.status,
          totalTasks: tasks.length,
          completedTasks,
          pendingTasks: tasks.length - completedTasks,
        };
      });

      res.json({ employees: formatted });
    } catch (err) {
      console.error("Error fetching performance:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * ✅ 2️⃣ Get full performance details of one employee
 * Used when clicking on an employee from the left list
 */
router.get(
  "/:employeeId",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const managerId = req.user!.id;
      const tenantId = req.user!.tenantId;

      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context missing" });
      }

      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          managerId, // 🔐 must belong to this manager
          user: {
            tenantId, // 🔐 tenant isolation
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              tasksAssigned: {
                where: {
                  isDeleted: false, // ✅ ignore soft-deleted tasks
                },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  priority: true,
                  dueDate: true,
                  assignedHours: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      });

      if (!employee) {
        return res.status(404).json({
          error: "Employee not found or not accessible",
        });
      }

      const tasks = employee.user.tasksAssigned;

      // --- Computed analytics ---
      const totalTasks = tasks.length;
      const completed = tasks.filter((t) => t.status === "DONE").length;
      const working = tasks.filter((t) => t.status === "WORKING").length;
      const stuck = tasks.filter((t) => t.status === "STUCK").length;

      const completionRate =
        totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

      const logs = await prisma.taskWorkLog.findMany({
        where: {
          userId: employee.user.id,
          task: { tenantId },
        },
      });

      const totalActualMinutes = logs.reduce((sum, log) => {
        const end = log.endTime ?? new Date();
        return sum + (end.getTime() - log.startTime.getTime()) / 60000;
      }, 0);

      const workedDates: any = new Set(
        logs
          .filter(l => l.endTime)
          .map(l => l.startTime.toISOString().split("T")[0])
      );

      const breakMinutes = await prisma.userAttendance.aggregate({
        _sum: { totalBreakMinutes: true },
        where: {
          userId: employee.user.id,
          workDate: {
            in: Array.from(workedDates).map((d: any) => new Date(d)),
          },
        },
      });

      const netActualMinutes = subtractBreakMinutes(
        totalActualMinutes,
        breakMinutes._sum.totalBreakMinutes || 0
      );

      const totalHours = Math.round((netActualMinutes / 60) * 10) / 10;

      res.json({
        employee: {
          id: employee.id,
          name: employee.name,
          roleTitle: employee.roleTitle,
          department: employee.department,
          email: employee.user.email,
          status: employee.status,
        },
        performance: {
          totalTasks,
          completed,
          working,
          stuck,
          completionRate,
          totalHours,
        },
        tasks,
      });
    } catch (err) {
      console.error("Error fetching employee details:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// router.get(
//   "/:employeeId/performance",
//   auth,
//   requireRole("MANAGER", "PROJECT_MANAGER"),
//   async (req, res) => {
//     try {
//       const { employeeId } = req.params;
//       const { id: userId, tenantId, role } = req.user!;

//       if (!employeeId) {
//         return res.status(400).json({ error: "Employee ID is required" });
//       }

//       if (!tenantId) {
//         return res.status(400).json({ error: "Tenant context missing" });
//       }

//       // --------------------------------
//       // ROLE-BASED ACCESS CONTROL
//       // --------------------------------
//       let employee;

//       if (role === "MANAGER") {
//         // MANAGER → can access only their employees
//         employee = await prisma.employee.findFirst({
//           where: {
//             id: employeeId,
//             tenantId,
//             managerId: userId,
//           },
//           include: employeePerformanceInclude(),
//         });
//       } else {
//         // PROJECT_MANAGER → can access managers only
//         employee = await prisma.employee.findFirst({
//           where: {
//             id: employeeId,
//             tenantId,
//             user: {
//               role: "MANAGER",
//             },
//           },
//           include: employeePerformanceInclude(),
//         });
//       }

//       if (!employee) {
//         return res
//           .status(404)
//           .json({ error: "Employee not found or not accessible" });
//       }

//       const tasks = employee.user.tasksAssigned;

//       // -----------------------------
//       // 📊 PERFORMANCE CALCULATIONS
//       // -----------------------------

//       const totalTasks = tasks.length;
//       const completedTasks = tasks.filter((t) => t.status === "DONE");
//       const activeTasks = tasks.filter((t) => t.status !== "DONE");

//       const completionRate =
//         totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

//       const logs = await prisma.taskWorkLog.findMany({
//         where: {
//           userId: employee.user.id,
//           task: { tenantId },
//         },
//       });

//       const totalActualMinutes = logs.reduce((sum, log) => {
//         const end = log.endTime ?? new Date();
//         return sum + (end.getTime() - log.startTime.getTime()) / 60000;
//       }, 0);

//       const totalHours = Math.round((totalActualMinutes / 60) * 10) / 10;

//       let onTimeCount = 0;
//       completedTasks.forEach((t) => {
//         if (!t.dueDate || new Date(t.updatedAt) <= new Date(t.dueDate)) {
//           onTimeCount++;
//         }
//       });
//       const totalAssignedMinutes = tasks.reduce(
//         (sum: any, t: any) => sum + (t.assignedHours || 0) * 60,
//         0
//       );

//       const efficiency =
//         totalAssignedMinutes > 0 && totalActualMinutes > 0
//           ? Math.min(
//             150,
//             Math.round((totalAssignedMinutes / totalActualMinutes) * 100)
//           )
//           : 0;

//       const rating =
//         efficiency >= 120 ? 5 :
//           efficiency >= 100 ? 4 :
//             efficiency >= 85 ? 3 :
//               efficiency >= 70 ? 2 : 1;


//       const activeDays = new Set(
//         logs.map(log => log.startTime.toDateString())
//       ).size;

//       const engagement = Math.min(100, activeDays * 20);

//       // Weekly hours (last 5 days)
//       const weeklyHours: { day: string; hours: number }[] = [];
//       const baseDate = to ?? new Date();
//       for (let i = 4; i >= 0; i--) {
//         const date = subDays(baseDate, i);
//         const dayLabel = format(date, "EEE");

//         const dayLogs = logs.filter(log =>
//           isSameDay(log.startTime, date)
//         );

//         const minutes = dayLogs.reduce((sum, log) => {
//           const end = log.endTime ?? new Date();
//           return sum + (end.getTime() - log.startTime.getTime()) / 60000;
//         }, 0);

//         weeklyHours.push({
//           day: dayLabel,
//           hours: Math.round((minutes / 60) * 10) / 10,
//         });
//       }


//       // Completion trend (last 4 weeks)
//       const completionTrend: { week: string; completion: number }[] = [];

//       for (let i = 3; i >= 0; i--) {
//         const weekStart = startOfWeek(subWeeks(new Date(), i));
//         const weekEnd = endOfWeek(subWeeks(new Date(), i));

//         const count = tasks.filter(
//           (t) =>
//             t.status === "DONE" &&
//             new Date(t.updatedAt) >= weekStart &&
//             new Date(t.updatedAt) <= weekEnd
//         ).length;

//         completionTrend.push({ week: `W${4 - i}`, completion: count });
//       }

//       const highPriorityCompleted = completedTasks.filter(
//         (t) => t.priority === "HIGH"
//       ).length;

//       const radar = [
//         { metric: "Quality", A: Math.round(rating * 20), fullMark: 100 },
//         {
//           metric: "Speed",
//           A: Math.min(100, completedTasks.length * 10),
//           fullMark: 100,
//         },
//         {
//           metric: "Reliability",
//           A: Math.round(completionRate),
//           fullMark: 100,
//         },
//         {
//           metric: "Focus",
//           A: Math.min(100, highPriorityCompleted * 20),
//           fullMark: 100,
//         },
//         { metric: "Activity", A: Math.round(engagement), fullMark: 100 },
//       ];

//       const skills = [
//         { skill: "Task Execution", percentage: Math.round(completionRate) },
//         { skill: "Time Management", percentage: Math.round(rating * 20) },
//         { skill: "Consistency", percentage: Math.round(engagement) },
//       ].sort((a, b) => b.percentage - a.percentage);

//       const achievements = completedTasks
//         .filter((t) => t.priority === "HIGH")
//         .sort(
//           (a, b) =>
//             new Date(b.updatedAt).getTime() -
//             new Date(a.updatedAt).getTime()
//         )
//         .slice(0, 3)
//         .map((t) => ({
//           title: "High Priority Completed",
//           subtitle: `Finished: ${t.title}`,
//           icon: "Trophy",
//         }));

//       if (achievements.length === 0 && completedTasks.length > 0) {
//         achievements.push({
//           title: "Steady Progress",
//           subtitle: `${completedTasks.length} tasks completed`,
//           icon: "Star",
//         });
//       }

//       // -----------------------------
//       // 📦 RESPONSE
//       // -----------------------------

//       res.json({
//         employee: {
//           id: employee.id,
//           name: employee.name,
//           roleTitle: employee.roleTitle,
//           department: employee.department,
//           email: employee.user.email,
//           status: employee.status,
//         },
//         performance: {
//           hours: totalHours,
//           completionRate: Math.round(completionRate),
//           engagement: Math.round(engagement),
//           rating: Number(rating.toFixed(1)),
//           weeklyHours,
//           completionTrend,
//           radar,
//           skills,
//           achievements,
//         },
//       });
//     } catch (err) {
//       console.error("Employee performance error:", err);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );



router.get(
  "/:employeeId/performance",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { id: userId, tenantId, role } = req.user!;

      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context missing" });
      }

      // --------------------------------
      // RESOLVE DATE RANGE (🔥 IMPORTANT)
      // --------------------------------
      const { from, to } = resolveDateRange(req.query);
      const rangeEnd = to ?? new Date();

      // --------------------------------
      // ROLE-BASED ACCESS CONTROL
      // --------------------------------
      let employee;

      if (role === "MANAGER") {
        employee = await prisma.employee.findFirst({
          where: {
            id: employeeId,
            tenantId,
            managerId: userId,
          },
          include: employeePerformanceInclude(),
        });
      } else {
        employee = await prisma.employee.findFirst({
          where: {
            id: employeeId,
            tenantId,
            user: { role: "MANAGER" },
          },
          include: employeePerformanceInclude(),
        });
      }

      if (!employee) {
        return res
          .status(404)
          .json({ error: "Employee not found or not accessible" });
      }

      const tasks = employee.user.tasksAssigned;

      // --------------------------------
      // FETCH WORK LOGS (TIME-BOUND)
      // --------------------------------
      const logs = await prisma.taskWorkLog.findMany({
        where: {
          userId: employee.user.id,
          startTime: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
          task: { tenantId },
        },
      });

      // --------------------------------
      // ACTUAL WORKED MINUTES (NO FAKE TIME)
      // --------------------------------
      const totalActualMinutes = logs.reduce((sum, log) => {
        if (!log.endTime) return sum; // 🚫 open logs don't count
        const end = log.endTime > rangeEnd ? rangeEnd : log.endTime;
        return (
          sum +
          Math.max(
            0,
            (end.getTime() - log.startTime.getTime()) / 60000
          )
        );
      }, 0);

      const workedDates: any = new Set(
        logs
          .filter(l => l.endTime)
          .map(l => l.startTime.toISOString().split("T")[0])
      );

      const breakMinutes = await prisma.userAttendance.aggregate({
        _sum: { totalBreakMinutes: true },
        where: {
          userId: employee.user.id,
          workDate: {
            in: Array.from(workedDates).map((d: any) => new Date(d)),
          },
        },
      });

      const netActualMinutes = subtractBreakMinutes(
        totalActualMinutes,
        breakMinutes._sum.totalBreakMinutes || 0
      );

      // --------------------------------
      // DAILY PAYROLL-CAPPED CALCULATION
      // --------------------------------
      const dailyMinutes: Record<string, number> = {};

      logs.forEach(log => {
        if (!log.endTime) return;

        const day: any = log.startTime.toISOString().split("T")[0];
        const minutes =
          (log.endTime.getTime() - log.startTime.getTime()) / 60000;

        dailyMinutes[day] = (dailyMinutes[day] || 0) + minutes;
      });

      // subtract break minutes (already aggregated safely)
      const netPayableMinutes = Object.values(dailyMinutes)
        .reduce((sum, minutes) => sum + Math.min(minutes, 8 * 60), 0);

      const totalHours =
        Math.round((netPayableMinutes / 60) * 10) / 10;

      // --------------------------------
      // TASK FILTERING BY RANGE
      // --------------------------------
      const taskIdsWorkedInRange = new Set(
        logs.filter(l => l.endTime).map(l => l.taskId)
      );

      const rangeTasks = tasks.filter((t: any) =>
        taskIdsWorkedInRange.has(t.id)
      );

      const completedTasks = rangeTasks.filter(
        (t) => t.status === "DONE"
      );

      const completionRate =
        rangeTasks.length > 0
          ? (completedTasks.length / rangeTasks.length) * 100
          : 0;

      // --------------------------------
      // ASSIGNED MINUTES (PAYROLL SAFE)
      // --------------------------------
      const totalAssignedMinutes = rangeTasks.reduce(
        (sum, t) => sum + (t.assignedHours || 0) * 60,
        0
      );

      // --------------------------------
      // EFFICIENCY (CAPPED)
      // --------------------------------
      const efficiency =
        totalAssignedMinutes > 0 && totalActualMinutes > 0
          ? Math.min(
            150,
            Math.round(
              (totalAssignedMinutes / totalActualMinutes) * 100
            )
          )
          : 0;


      const rating =
        efficiency >= 120 ? 5 :
          efficiency >= 100 ? 4 :
            efficiency >= 85 ? 3 :
              efficiency >= 70 ? 2 : 1;

      // --------------------------------
      // ENGAGEMENT (ACTIVE DAYS ONLY)
      // --------------------------------
      const activeDays = new Set(
        logs
          .filter((l) => l.endTime)
          .map((l) => l.startTime.toDateString())
      ).size;

      const dailyWorkedMinutes: Record<string, number> = {};

      logs.filter(l => l.endTime).forEach(log => {
        let cursor = new Date(log.startTime);
        const end = log.endTime!;

        while (cursor < end) {
          const dayKey: any = cursor.toISOString().split("T")[0];

          const dayStart = new Date(cursor);
          dayStart.setHours(0, 0, 0, 0);

          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const overlapStart = cursor;
          const overlapEnd = end < dayEnd ? end : dayEnd;

          const minutes: any =
            (overlapEnd.getTime() - overlapStart.getTime()) / 60000;

          dailyWorkedMinutes[dayKey] =
            (dailyWorkedMinutes[dayKey] || 0) + minutes;

          cursor = dayEnd;
        }
      });


      const cappedMinutes = Object.values(dailyWorkedMinutes)
        .reduce((sum, m) => sum + Math.min(m, 8 * 60), 0);

      const engagement =
        activeDays === 0
          ? 0
          : Math.round(
            Math.min(
              100,
              (cappedMinutes / (activeDays * 8 * 60)) * 100
            )
          );

      // --------------------------------
      // WEEKLY / RANGE HOURS CHART
      // --------------------------------
      const weeklyHours: { day: string; hours: number }[] = [];
      const baseDate = rangeEnd;
      const chartDays =
        req.query.range === "7d" ? 7 :
          req.query.range === "14d" ? 7 :
            req.query.range === "30d" ? 7 :
              7; // always show last 7 days visually

      for (let i = chartDays - 1; i >= 0; i--) {
        const date = subDays(baseDate, i);
        const dayLabel = format(date, "EEE");

        const minutes = logs.reduce((sum, log) => {
          if (!log.endTime) return sum;

          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);

          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const overlapStart =
            log.startTime < dayStart ? dayStart : log.startTime;

          const overlapEnd =
            log.endTime > dayEnd ? dayEnd : log.endTime;

          if (overlapStart >= overlapEnd) return sum;

          return sum + (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
        }, 0);

        const minutesForDay = Math.min(minutes, 8 * 60);

        weeklyHours.push({
          day: dayLabel,
          hours: Math.round((minutesForDay / 60) * 10) / 10,
        });
      }


      // --------------------------------
      // COMPLETION TREND (RANGE-AWARE)
      // --------------------------------
      const completionTrend: { week: string; completion: number }[] = [];

      const rangeEnd1 = rangeEnd; // MUST be now

      for (let i = 3; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(rangeEnd1, i), {
          weekStartsOn: 1,
        });

        const weekEnd = endOfWeek(subWeeks(rangeEnd1, i), {
          weekStartsOn: 1,
        });


        console.log("Trend employee userId:", employee.user.id);
        console.log("Trend range:", weekStart, weekEnd);

        const count = await prisma.task.count({
          where: {
            assigneeId: employee.user.id,
            status: "DONE",
            isDeleted: false,
            completedAt: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
        });

        completionTrend.push({
          week: `W${4 - i}`,
          completion: count,
        });
      }




      // --------------------------------
      // RADAR / SKILLS / ACHIEVEMENTS
      // --------------------------------
      const highPriorityCompleted = completedTasks.filter(
        (t) => t.priority === "HIGH"
      ).length;

      const radar = [
        { metric: "Quality", A: rating * 20, fullMark: 100 },
        {
          metric: "Speed",
          A: Math.min(100, completedTasks.length * 10),
          fullMark: 100,
        },
        {
          metric: "Reliability",
          A: Math.round(completionRate),
          fullMark: 100,
        },
        {
          metric: "Focus",
          A: Math.min(100, highPriorityCompleted * 20),
          fullMark: 100,
        },
        { metric: "Activity", A: engagement, fullMark: 100 },
      ];

      const skills = [
        { skill: "Task Execution", percentage: Math.round(completionRate) },
        { skill: "Time Management", percentage: rating * 20 },
        { skill: "Consistency", percentage: engagement },
      ].sort((a, b) => b.percentage - a.percentage);

      const achievements = completedTasks
        .filter((t) => t.priority === "HIGH")
        .slice(0, 3)
        .map((t) => ({
          title: "High Priority Completed",
          subtitle: `Finished: ${t.title}`,
          icon: "Trophy",
        }));

      // --------------------------------
      // RESPONSE
      // --------------------------------
      res.json({
        employee: {
          id: employee.id,
          name: employee.name,
          roleTitle: employee.roleTitle,
          department: employee.department,
          email: employee.user.email,
          status: employee.status,
        },
        performance: {
          hours: totalHours,
          completionRate: Math.round(completionRate),
          engagement,
          efficiency,
          rating,
          weeklyHours,
          completionTrend,
          radar,
          skills,
          achievements,
        },
      });
    } catch (err) {
      console.error("Employee performance error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);


router.post("/attendance/break/start", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const today = getTodayDate();

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1️⃣ Fetch today's attendance (TENANT-SCOPED)
    const attendance = await prisma.userAttendance.findFirst({
      where: {
        userId,
        workDate: today,
        user: {
          tenantId, // 🔐 tenant isolation
        },
      },
    });

    if (!attendance) {
      return res.status(400).json({ error: "Attendance not found" });
    }

    // 2️⃣ Validate active session
    if (!attendance.isActiveSession) {
      return res
        .status(400)
        .json({ error: "No active work session" });
    }

    // 3️⃣ Prevent multiple active breaks
    if (attendance.breakStartTime && !attendance.breakEndTime) {
      return res.status(400).json({ error: "Break already active" });
    }

    const now = new Date();

    // 4️⃣ Create break log
    await prisma.breakLog.create({
      data: {
        attendanceId: attendance.id,
        breakStart: now,
      },
    });

    // 5️⃣ Update attendance
    await prisma.userAttendance.update({
      where: { id: attendance.id },
      data: {
        breakStartTime: now,
        breakEndTime: null,
      },
    });

    res.json({
      message: "Break started",
      breakStartTime: now,
    });
  } catch (err) {
    console.error("Break start error:", err);
    res.status(500).json({ error: "Failed to start break" });
  }
});

router.post("/attendance/break/end", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const today = getTodayDate();

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1️⃣ Fetch attendance (TENANT SCOPED)
    const attendance = await prisma.userAttendance.findFirst({
      where: {
        userId,
        workDate: today,
        user: {
          tenantId, // 🔐 tenant isolation
        },
      },
      include: {
        breakLogs: true,
      },
    });

    if (!attendance) {
      return res.status(400).json({ error: "Attendance not found" });
    }

    // 2️⃣ Ensure session is active
    if (!attendance.isActiveSession) {
      return res.status(400).json({ error: "No active session" });
    }

    // 3️⃣ Ensure a break is active
    if (!attendance.breakStartTime) {
      return res.status(400).json({ error: "No active break" });
    }

    const now = new Date();

    // 4️⃣ Find last open break safely
    const openBreak = attendance.breakLogs
      .filter((b) => !b.breakEnd)
      .sort(
        (a, b) => b.breakStart.getTime() - a.breakStart.getTime()
      )[0];

    if (!openBreak) {
      return res.status(400).json({ error: "No open break found" });
    }

    // 5️⃣ Calculate break duration
    const breakMinutes = Math.ceil(
      (now.getTime() - openBreak.breakStart.getTime()) / 60000
    );

    // 6️⃣ Close break log
    await prisma.breakLog.update({
      where: { id: openBreak.id },
      data: { breakEnd: now },
    });

    // 7️⃣ Update attendance
    await prisma.userAttendance.update({
      where: { id: attendance.id },
      data: {
        breakEndTime: now,
        breakStartTime: null,
        totalBreakMinutes:
          attendance.totalBreakMinutes + breakMinutes,
      },
    });

    res.json({
      message: "Break ended",
      breakMinutes,
    });
  } catch (err) {
    console.error("Break end error:", err);
    res.status(500).json({ error: "Failed to end break" });
  }
});

router.get("/employees/attendance/current", auth, async (req, res) => {
  const userId = req.user?.id;
  const tenantId = req.user?.tenantId;

  if (!userId || !tenantId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Today (00:00)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.userAttendance.findFirst({
    where: {
      userId,
      workDate: today,
      user: {
        tenantId, // 🔐 tenant isolation
      },
    },
  });

  if (!attendance) {
    return res.json({
      isOnBreak: false,
      loginTime: null,
      breakStartTime: null,
    });
  }

  res.json({
    isOnBreak: !!attendance.breakStartTime && !attendance.breakEndTime,
    loginTime: attendance.loginTime,
    breakStartTime: attendance.breakStartTime,
  });
});

router.get("/attendance/today", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.userAttendance.findFirst({
      where: {
        userId,
        workDate: today,
        user: {
          tenantId, // 🔐 tenant isolation
        },
      },
    });

    if (!attendance) {
      return res.json({
        onBreak: false,
        breakStartTime: null,
        loginTime: null,
      });
    }

    const onBreak =
      attendance.breakStartTime !== null &&
      attendance.breakEndTime === null;

    return res.json({
      onBreak,
      breakStartTime: attendance.breakStartTime,
      loginTime: attendance.loginTime,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

router.get("/dashboard/operator/today-performance", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1️⃣ Define today range (server timezone)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);

    // 2️⃣ Fetch today's task work logs (TENANT SAFE)
    const workLogs = await prisma.taskWorkLog.findMany({
      where: {
        userId,
        startTime: {
          gte: todayStart,
          lt: todayEnd,
        },
        task: {
          tenantId, // 🔐 tenant isolation
        },
      },
      include: {
        task: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    if (workLogs.length === 0) {
      return res.json({
        tasks: [],
        summary: {
          totalAssignedMinutes: 0,
          totalActualMinutes: 0,
          efficiencyPercent: 100,
        },
      });
    }

    // 3️⃣ Aggregate logs by task (NO time fabrication)
    const taskMap: Record<string, any> = {};

    for (const log of workLogs) {
      const taskId = log.taskId;

      if (!taskMap[taskId]) {
        taskMap[taskId] = {
          taskId,
          title: log.task.title,
          status: log.task.status,
          assignedMinutes: (log.task.assignedHours || 0) * 60,
          actualMinutes: 0,
          startTime: log.startTime,
          endTime: log.endTime ?? null,
        };
      }

      // Calculate minutes ONLY if endTime exists
      const end = log.endTime ?? new Date(); // 👈 LIVE TIME

      const minutes = Math.max(
        0,
        Math.round(
          (end.getTime() - log.startTime.getTime()) / 60000
        )
      );

      taskMap[taskId].actualMinutes += minutes;


      // Earliest start time
      if (log.startTime < taskMap[taskId].startTime) {
        taskMap[taskId].startTime = log.startTime;
      }

      // Latest REAL end time
      if (log.endTime) {
        if (
          !taskMap[taskId].endTime ||
          log.endTime > taskMap[taskId].endTime
        ) {
          taskMap[taskId].endTime = log.endTime;
        }
      }
    }

    // 4️⃣ Prepare response
    let totalAssignedMinutes = 0;
    let totalActualMinutes = 0;

    const tasks = Object.values(taskMap).map((task: any) => {
      totalAssignedMinutes += task.assignedMinutes;
      totalActualMinutes += task.actualMinutes;

      return {
        taskId: task.taskId,
        title: task.title,
        status: task.status,
        assignedMinutes: task.assignedMinutes,
        actualMinutes: task.actualMinutes,
        varianceMinutes: task.actualMinutes - task.assignedMinutes,
        startTime: task.startTime?.toISOString() ?? null,
        endTime: task.endTime?.toISOString() ?? null,
        isRunning: task.endTime === null,
      };
    });

    // 5️⃣ Efficiency calculation (correct)
    const efficiencyPercent =
      totalAssignedMinutes > 0 && totalActualMinutes > 0
        ? Math.min(
          150,
          Math.round(
            (totalAssignedMinutes / totalActualMinutes) * 100
          )
        )
        : 0;
    // 6️⃣ Send response
    res.json({
      tasks,
      summary: {
        totalAssignedMinutes,
        totalActualMinutes,
        efficiencyPercent,
      },
    });
  } catch (error) {
    console.error("Today performance error:", error);
    res.status(500).json({ error: "Failed to load today performance" });
  }
});

router.get("/dashboard/manager/today-performance", auth, async (req, res) => {
  try {
    const managerId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!managerId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1️⃣ Find employees under this manager (TENANT SAFE)
    const employees = await prisma.employee.findMany({
      where: {
        managerId,
        user: {
          tenantId,            // 🔐 tenant isolation
          role: "OPERATOR",
        },
      },
      select: {
        userId: true,
        name: true,
      },
    });

    const operatorIds = employees.map(e => e.userId);

    if (operatorIds.length === 0) {
      return res.json({
        tasks: [],
        summary: {
          totalAssignedMinutes: 0,
          totalActualMinutes: 0,
          efficiencyPercent: 100,
        },
      });
    }

    // 2️⃣ Define today range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);

    // 3️⃣ Fetch work logs (TENANT SAFE VIA TASK)
    const workLogs = await prisma.taskWorkLog.findMany({
      where: {
        userId: { in: operatorIds },
        startTime: {
          gte: todayStart,
          lt: todayEnd,
        },
        task: {
          tenantId, // 🔐 CRITICAL
        },
      },
      include: {
        task: true,
        user: true,
      },
      orderBy: { startTime: "asc" },
    });

    // 4️⃣ Aggregate by task (NO fabricated time)
    const taskMap: Record<string, any> = {};

    for (const log of workLogs) {
      const taskId = log.taskId;

      if (!taskMap[taskId]) {
        taskMap[taskId] = {
          taskId,
          title: log.task.title,
          assignedMinutes: (log.task.assignedHours || 0) * 60,
          actualMinutes: 0,
          startTime: log.startTime,
          endTime: log.endTime ?? null,
        };
      }

      // Only closed logs count
      const end = log.endTime ?? new Date();

      const minutes = Math.max(
        0,
        Math.round(
          (end.getTime() - log.startTime.getTime()) / 60000
        )
      );

      taskMap[taskId].actualMinutes += minutes;


      // Earliest start
      if (log.startTime < taskMap[taskId].startTime) {
        taskMap[taskId].startTime = log.startTime;
      }

      // Latest REAL endTime
      if (log.endTime) {
        if (
          !taskMap[taskId].endTime ||
          log.endTime > taskMap[taskId].endTime
        ) {
          taskMap[taskId].endTime = log.endTime;
        }
      }
    }

    // 5️⃣ Prepare response
    let totalAssignedMinutes = 0;
    let totalActualMinutes = 0;

    const tasks = Object.values(taskMap).map((task: any) => {
      totalAssignedMinutes += task.assignedMinutes;
      totalActualMinutes += task.actualMinutes;

      return {
        taskId: task.taskId,
        title: task.title,
        assignedMinutes: task.assignedMinutes,
        actualMinutes: task.actualMinutes,
        varianceMinutes: task.actualMinutes - task.assignedMinutes,
        startTime: task.startTime?.toISOString() ?? null,
        endTime: task.endTime?.toISOString() ?? null,
        isRunning: task.endTime === null,
      };
    });

    const efficiencyPercent =
      totalAssignedMinutes > 0 && totalActualMinutes > 0
        ? Math.min(
          150,
          Math.round(
            (totalAssignedMinutes / totalActualMinutes) * 100
          )
        )
        : 0;

    res.json({
      tasks,
      summary: {
        totalAssignedMinutes,
        totalActualMinutes,
        efficiencyPercent,
      },
    });
  } catch (error) {
    console.error("Manager today performance error:", error);
    res.status(500).json({ error: "Failed to load manager performance" });
  }
});



export default router;
