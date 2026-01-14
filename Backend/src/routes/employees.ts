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
} from "date-fns";

const router = Router();

// GET all employees (manager)


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
    const managerId = req.user!.id;

    try {
      const employees = await prisma.employee.findMany({
        where: { managerId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              tasksAssigned: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  priority: true,
                  dueDate: true,
                  isDeleted: true,
                  fileUrl_manager: true,
                  fileUrl_operator: true,
                },
              },
            },
          },
        },
      });

      let TaskCompleted = 0;

      const formattedEmployees = employees.map((emp) => ({
        id: emp.id,
        name: emp.name,
        role: emp.roleTitle,
        email: emp.user.email,
        tasks: emp.user.tasksAssigned
          .filter((task) => {
            if (!task.isDeleted) {
              // Include only active tasks
              if (task.status === "DONE") {
                TaskCompleted += 1;
              }
              return true;
            }
            return false;
          })
          .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status === "DONE" ? "Done" : task.status,
            priority: task.priority,
            fileUrl_manager: task.fileUrl_manager,
            fileUrl_operator: task.fileUrl_operator,
            dueDate: task.dueDate?.toISOString().split("T")[0] || null,
          })),
      }));

      res.json({
        employees: formattedEmployees,
        TaskCompletedCount: TaskCompleted,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  }
);

router.post("/create", requireAuth, async (req, res) => {
  try {
    const { email, name, roleTitle, department, role } = req.body;

    // 1️⃣ Create user in Keycloak
    const kcUser = await kcCreateUser({
      email,
      firstName: name,
      tempPassword: "Temp@123",
    });
    await kcAssignRealmRole(kcUser.id, role);

    // 2️⃣ Store in Prisma
    const user = await prisma.user.create({
      data: {
        email,
        password: "",
        role,
      },
    });

    await prisma.employee.create({
      data: {
        userId: user.id,
        name,
        roleTitle,
        department,
      },
    });

    // 3️⃣ Link with ExternalIdentity
    await prisma.externalIdentity.create({
      data: {
        provider: "keycloak",
        subject: kcUser.id,
        email,
        userId: user.id,
      },
    });

    res.json({ success: true, message: "Employee created in Keycloak + DB" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET dashboard metrics
router.get(
  "/dashboard",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    const managerId = req.user!.id;

    // Total employees
    const totalEmployees = await prisma.employee.count({
      where: { managerId },
    });

    // Active employees
    const activeEmployees = await prisma.employee.count({
      where: { status: "Active", managerId },
    });

    // Total tasks created by this manager
    const totalTasks = await prisma.task.count({
      where: { createdById: managerId },
    });

    // Completed tasks
    const completedTasks = await prisma.task.count({
      where: { createdById: managerId, status: "DONE" },
    });

    // Completion rate
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Weekly hours overview (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

    const weeklyTasks = await prisma.task.findMany({
      where: {
        createdById: managerId,
        dueDate: { gte: oneWeekAgo },
        assignedHours: { not: null },
      },
      select: { dueDate: true, assignedHours: true },
    });

    // Sum hours per day
    const weeklyData: { day: string; hours: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(oneWeekAgo);
      date.setDate(oneWeekAgo.getDate() + i);
      const dayStr = date.toLocaleDateString("en-US", { weekday: "short" });
      const hours = weeklyTasks
        .filter((t) => t.dueDate!.toDateString() === date.toDateString())
        .reduce((sum, t) => sum + (t.assignedHours || 0), 0);
      weeklyData.push({ day: dayStr, hours });
    }

    // Task completion trend (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const trendTasks = await prisma.task.findMany({
      where: { createdById: managerId, dueDate: { gte: fourWeeksAgo } },
      select: { dueDate: true, status: true },
    });

    const performanceData: { week: string; completion: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const start = new Date(fourWeeksAgo);
      start.setDate(fourWeeksAgo.getDate() + w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const weekTasks = trendTasks.filter(
        (t) => t.dueDate! >= start && t.dueDate! <= end
      );
      const doneCount = weekTasks.filter((t) => t.status === "DONE").length;
      const completion =
        weekTasks.length > 0
          ? Math.round((doneCount / weekTasks.length) * 100)
          : 0;

      performanceData.push({ week: `Week ${w + 1}`, completion });
    }

    // Team overview: employees with tasks completed & hours logged
    const employees = await prisma.employee.findMany({
      where: { managerId },
      include: {
        user: {
          include: {
            tasksAssigned: true, // include all fields of tasksAssigned
          },
        },
      },
    });

    const teamOverview = employees.map((emp) => {
      const tasks = emp.user?.tasksAssigned || [];
      const tasksCompleted = tasks.filter((t) => t.status === "DONE").length;
      const hoursLogged = tasks.reduce(
        (sum, t) => sum + (t.assignedHours || 0),
        0
      );
      const efficiency =
        tasks.length > 0
          ? Math.round((tasksCompleted / tasks.length) * 100)
          : 0;
      return {
        id: emp.id,
        name: emp.name,
        role: emp.roleTitle,
        status: emp.status,
        tasksCompleted,
        hoursLogged,
        efficiency,
      };
    });

    res.json({
      totalEmployees,
      activeEmployees,
      totalTasks,
      completionRate,
      weeklyData,
      performanceData,
      teamOverview,
    });
  }
);

// GET my employee profile (operator)
router.get("/me", auth, requireRole("OPERATOR"), async (req, res) => {
  const me = await prisma.employee.findUnique({
    where: { userId: req.user!.id },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  res.json(me);
});

// Create employee + user (manager)
router.post(
  "/",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    const { email, password, name, roleTitle, department } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: "email, password, name required" });

    const managerId = req.user!.id;

    if (!managerId)
      return res.status(400).json({ error: "Manager ID not found" });

    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.hash(
      password,
      Number(process.env.BCRYPT_ROUNDS) || 10
    );

    const user = await prisma.user.create({
      data: { email, password: hash, role: "OPERATOR" },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        name,
        roleTitle: roleTitle ?? "Operator",
        department,
        managerId,
      },
    });

    res.status(201).json({
      employee,
      user: { id: user.id, email: user.email, role: user.role },
    });
  }
);

// performace
router.get(
  "/performance",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const managerId = req.user!.id;

      // Fetch employees under this manager
      const employees = await prisma.employee.findMany({
        where: { managerId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              tasksAssigned: {
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

      const formatted = employees.map((emp) => ({
        id: emp.id,
        name: emp.name,
        roleTitle: emp.roleTitle,
        email: emp.user.email,
        department: emp.department,
        status: emp.status,
        totalTasks: emp.user.tasksAssigned.length,
        completedTasks: emp.user.tasksAssigned.filter(
          (t) => t.status === "DONE"
        ).length,
        pendingTasks: emp.user.tasksAssigned.filter((t) => t.status !== "DONE")
          .length,
      }));

      res.json({ employees: formatted });
    } catch (err) {
      console.error("Error fetching employees:", err);
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

      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              tasksAssigned: {
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

      if (!employee)
        return res.status(404).json({ error: "Employee not found" });

      const tasks = employee.user.tasksAssigned;

      // --- Simple computed analytics ---
      const totalTasks = tasks.length;
      const completed = tasks.filter((t) => t.status === "DONE").length;
      const working = tasks.filter((t) => t.status === "WORKING").length;
      const stuck = tasks.filter((t) => t.status === "STUCK").length;

      const completionRate =
        totalTasks > 0 ? (completed / totalTasks) * 100 : 0;

      // Calculate total assigned hours (if available)
      const totalHours = tasks.reduce(
        (acc, t) => acc + (t.assignedHours || 0),
        0
      );

      const performance = {
        totalTasks,
        completed,
        working,
        stuck,
        completionRate: Math.round(completionRate),
        totalHours,
      };

      res.json({
        employee: {
          id: employee.id,
          name: employee.name,
          roleTitle: employee.roleTitle,
          department: employee.department,
          email: employee.user.email,
          status: employee.status,
        },
        performance,
        tasks,
      });
    } catch (err) {
      console.error("Error fetching employee details:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get(
  "/:employeeId/performance",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const { employeeId } = req.params;

      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      // 1. Fetch Employee with ALL tasks
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              tasksAssigned: {
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

      if (!employee)
        return res.status(404).json({ error: "Employee not found" });

      const tasks = employee.user.tasksAssigned;

      // --- DYNAMIC CALCULATIONS ---

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "DONE");
      const activeTasks = tasks.filter((t) => t.status !== "DONE");

      // 1. Completion Rate
      const completionRate =
        totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

      // 2. Total Hours (Sum of assigned hours)
      const totalHours = tasks.reduce(
        (acc, t) => acc + (t.assignedHours || 0),
        0
      );

      // 3. Rating Calculation (Heuristic: On-time completion)
      // If a task is DONE and updatedAt <= dueDate, it's good.
      let onTimeCount = 0;
      completedTasks.forEach((t) => {
        // If no due date, we give benefit of doubt
        if (!t.dueDate) {
          onTimeCount++;
        } else if (new Date(t.updatedAt) <= new Date(t.dueDate)) {
          onTimeCount++;
        }
      });
      // Rating out of 5
      const rating =
        completedTasks.length > 0
          ? (onTimeCount / completedTasks.length) * 5
          : 0;

      // 4. Engagement (Heuristic: % of tasks touched in the last 7 days)
      const oneWeekAgo = subDays(new Date(), 7);
      const recentTasks = tasks.filter(
        (t) => new Date(t.updatedAt) >= oneWeekAgo
      );
      const engagement =
        totalTasks > 0 ? (recentTasks.length / totalTasks) * 100 : 0;

      // 5. Weekly Hours Breakdown (Last 5 Days)
      // Logic: Sum assignedHours of tasks UPDATED on that specific day
      const weeklyHours: { day: string; hours: number }[] = [];
      for (let i = 4; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayLabel = format(date, "EEE"); // Mon, Tue...

        // Find tasks updated on this day
        const dayEffort = tasks
          .filter((t) => isSameDay(new Date(t.updatedAt), date))
          .reduce((acc, t) => acc + (t.assignedHours || 0), 0);

        weeklyHours.push({ day: dayLabel, hours: dayEffort });
      }

      // 6. Completion Trend (Last 4 Weeks)
      const completionTrend: { week: string; completion: number }[] = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(new Date(), i));
        const weekEnd = endOfWeek(subWeeks(new Date(), i));

        const count = tasks.filter(
          (t) =>
            t.status === "DONE" &&
            new Date(t.updatedAt) >= weekStart &&
            new Date(t.updatedAt) <= weekEnd
        ).length;

        completionTrend.push({ week: `W${4 - i}`, completion: count });
      }

      // 7. Radar Chart Metrics (Normalized to 100)
      const highPriorityCount = completedTasks.filter(
        (t) => t.priority === "HIGH"
      ).length;

      const radar = [
        { metric: "Quality", A: Math.round(rating * 20), fullMark: 100 }, // Rating to %
        {
          metric: "Speed",
          A: Math.min(100, completedTasks.length * 10),
          fullMark: 100,
        }, // Volume based
        { metric: "Reliability", A: Math.round(completionRate), fullMark: 100 },
        {
          metric: "Focus",
          A: Math.min(100, highPriorityCount * 20),
          fullMark: 100,
        }, // High priority handling
        { metric: "Activity", A: Math.round(engagement), fullMark: 100 },
      ];

      // 8. Inferred Skills (Based on task data)
      const skills = [
        { skill: "Task Execution", percentage: Math.round(completionRate) },
        { skill: "Time Mgmt", percentage: Math.round(rating * 20) },
        { skill: "Consistency", percentage: Math.round(engagement) },
      ].sort((a, b) => b.percentage - a.percentage);

      // 9. Recent Achievements (High Priority Done tasks)
      const achievements = completedTasks
        .filter((t) => t.priority === "HIGH")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ) // Newest first
        .slice(0, 3)
        .map((t) => ({
          title: "High Priority Complete",
          subtitle: `Finished: ${t.title}`,
          icon: "Trophy",
        }));

      // Fallback achievement if empty
      if (achievements.length === 0 && completedTasks.length > 0) {
        achievements.push({
          title: "Steady Progress",
          subtitle: `${completedTasks.length} tasks completed`,
          icon: "Star",
        });
      }

      const performanceData = {
        hours: totalHours,
        hoursChange: 0, // Needs historical data to calc real change
        completionRate: Math.round(completionRate),
        completionChange: 0,
        engagement: Math.round(engagement),
        engagementChange: 0,
        rating: Number(rating.toFixed(1)),
        ratingChange: 0,
        weeklyHours,
        completionTrend,
        radar,
        skills,
        achievements,
      };

      res.json({
        employee: {
          id: employee.id,
          name: employee.name,
          roleTitle: employee.roleTitle,
          department: employee.department,
          email: employee.user.email,
          status: employee.status,
        },
        performance: performanceData,
      });
    } catch (err) {
      console.error("Error fetching employee performance:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Attandance

router.post("/attendance/break/start", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const today = getTodayDate();

    if (!userId) {
      return res.status(500).json({ error: "User not found" });
    }

    const attendance = await prisma.userAttendance.findUnique({
      where: {
        userId_workDate: { userId, workDate: today },
      },
    });

    if (!attendance)
      return res.status(400).json({ error: "Attendance not found" });

    if (attendance.breakStartTime && !attendance.breakEndTime) {
      return res.status(400).json({ error: "Break already active" });
    }

    const now = new Date();

    // Create break log
    await prisma.breakLog.create({
      data: {
        attendanceId: attendance.id,
        breakStart: now,
      },
    });

    // Update attendance
    await prisma.userAttendance.update({
      where: { id: attendance.id },
      data: {
        breakStartTime: now,
        breakEndTime: null,
      },
    });

    res.json({ message: "Break started", breakStartTime: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start break" });
  }
});


router.post("/attendance/break/end", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const today = getTodayDate();


    if (!userId) {
      return res.status(500).json({ error: "User not found" });
    }

    const attendance = await prisma.userAttendance.findUnique({
      where: {
        userId_workDate: { userId, workDate: today },
      },
      include: { breakLogs: true },
    });

    if (!attendance)
      return res.status(400).json({ error: "Attendance not found" });

    if (!attendance.breakStartTime) {
      return res.status(400).json({ error: "No active break" });
    }

    const now = new Date();

    // Find last open break
    const openBreak = attendance.breakLogs
      .filter(b => !b.breakEnd)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!openBreak)
      return res.status(400).json({ error: "No open break found" });

    const breakMinutes = Math.ceil(
      (now.getTime() - openBreak.breakStart.getTime()) / 60000
    );

    // Close break log
    await prisma.breakLog.update({
      where: { id: openBreak.id },
      data: { breakEnd: now },
    });

    // Update attendance
    await prisma.userAttendance.update({
      where: { id: attendance.id },
      data: {
        breakEndTime: now,
        breakStartTime: null,
        totalBreakMinutes: attendance.totalBreakMinutes + breakMinutes,
      },
    });

    res.json({
      message: "Break ended",
      breakMinutes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to end break" });
  }
});

// GET current attendance status
router.get("/employees/attendance/current", auth, async (req, res) => {
  const userId = req.user?.id;

  if(!userId){
    return res.status(400).json({ error: "User not found" });
  }

  // Today (00:00)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.userAttendance.findUnique({
    where: {
      userId_workDate: {
        userId,
        workDate: today,
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!userId) {
      return res.status(400).json({ error: "User not found" });
    }

    const attendance = await prisma.userAttendance.findUnique({
      where: {
        userId_workDate: {
          userId,
          workDate: today,
        },
      },
    });

    if (!attendance) {
      return res.json({ onBreak: false });
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



export default router;
