import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import prisma from "../db";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { TaskStatus } from "@prisma/client";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase environment variables are not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

router.post(
  "/create",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  upload.single("file"),
  async (req, res) => {
    try {
      const {
        title,
        notes,
        dueDate,
        priority,
        assignedHours,
        assigneeUserId,
        assigneeEmployeeId,
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }

      const tenantId: any = req.user!.tenantId; // 🔑 SOURCE OF TRUTH

      let assigneeId: string | undefined = assigneeUserId;

      // 🔒 Ensure employee belongs to SAME TENANT
      if (!assigneeId && assigneeEmployeeId) {
        const emp = await prisma.employee.findFirst({
          where: {
            id: assigneeEmployeeId,
            user: {
              tenantId,
            },
          },
        });

        if (!emp) {
          return res
            .status(400)
            .json({ error: "invalid assignee (tenant mismatch)" });
        }

        assigneeId = emp.userId;
      }

      // 📁 File upload (unchanged)
      let fileUrl: string | null = null;

      if (req.file) {
        const fileName = `${Date.now()}_${req.file.originalname}`;

        const { error } = await supabase.storage
          .from("ManagerFiles")
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
          });

        if (error) {
          return res.status(500).json({ error: "file upload failed" });
        }

        const { data } = supabase.storage
          .from("ManagerFiles")
          .getPublicUrl(fileName);

        fileUrl = data.publicUrl;
      }

      // ✅ CREATE TASK WITH TENANT ID
      const task = await prisma.task.create({
        data: {
          title,
          notes,
          dueDate: dueDate ? new Date(dueDate) : null,
          priority,
          assignedHours: assignedHours
            ? parseInt(assignedHours)
            : null,

          tenantId, // 🔑 REQUIRED FOR MULTI-TENANT

          createdById: req.user!.id,
          assigneeId: assigneeId || null,
          fileUrl_manager: fileUrl,
        },
      });

      // send the email notification to the employee

      res.status(201).json(task);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create task" });
    }
  }
);

router.patch(
  "/:id",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  upload.single("file"),
  async (req, res) => {
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    const tenantId = req.user!.tenantId;

    const {
      title,
      notes,
      dueDate,
      priority,
      assignedHours,
      assigneeUserId,
      assigneeEmployeeId,
    }: any = req.body;

    try {
      // 🔒 STEP 1: FETCH TASK WITH TENANT CHECK
      const existingTask = await prisma.task.findFirst({
        where: {
          id: taskId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!existingTask) {
        return res.status(404).json({
          error: "Task not found or does not belong to your tenant",
        });
      }

      // --- Handle Assignee Logic (TENANT SAFE) ---
      let newAssigneeId: string | undefined;

      if (assigneeUserId) {
        const user = await prisma.user.findFirst({
          where: {
            id: assigneeUserId,
            tenantId,
          },
        });

        if (!user) {
          return res
            .status(400)
            .json({ error: "Assignee does not belong to your tenant" });
        }

        newAssigneeId = user.id;
      } else if (assigneeEmployeeId) {
        const emp = await prisma.employee.findFirst({
          where: {
            id: assigneeEmployeeId,
            user: {
              tenantId,
            },
          },
          include: {
            user: true,
          },
        });

        if (!emp) {
          return res
            .status(400)
            .json({ error: "Invalid employee or tenant mismatch" });
        }

        newAssigneeId = emp.userId;
      }

      // --- Handle File Upload ---
      let newFileUrl: string | undefined;

      if (req.file) {
        const fileName = `${Date.now()}_${req.file.originalname}`;

        const { error } = await supabase.storage
          .from("ManagerFiles")
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
          });

        if (error) {
          return res.status(500).json({ error: "File upload failed" });
        }

        const { data } = supabase.storage
          .from("ManagerFiles")
          .getPublicUrl(fileName);

        newFileUrl = data.publicUrl;
      }

      // --- Build Update Object Safely ---
      const updateData: any = {};

      if (title) updateData.title = title;
      if (priority) updateData.priority = priority;
      if (notes !== undefined) updateData.notes = notes;
      if (dueDate) updateData.dueDate = new Date(dueDate);
      if (assignedHours)
        updateData.assignedHours = parseInt(assignedHours);
      if (newAssigneeId) updateData.assigneeId = newAssigneeId;
      if (newFileUrl) updateData.fileUrl_manager = newFileUrl;

      // 🔒 STEP 2: UPDATE WITH TENANT CONDITION
      const task = await prisma.task.update({
        where: { id: existingTask.id },
        data: updateData,
      });

      res.json(task);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update task" });
    }
  }
);

router.get("/", auth, async (req, res) => {
  const { id: userId, role, tenantId } = req.user!;

  const isManager = role === "MANAGER" || role === "PROJECT_MANAGER";

  // 🔒 BASE TENANT FILTER (MANDATORY)
  const where: any = {
    tenantId,
    isDeleted: false,
  };

  // 👤 OPERATOR → only own tasks
  if (!isManager) {
    where.assigneeId = userId;
  }

  // 🔎 Optional filters (still tenant-safe)
  const { assigneeId, status } = req.query;

  if (assigneeId && isManager) {
    where.assigneeId = String(assigneeId);
  }

  if (status) {
    where.status = String(status).toUpperCase();
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  res.json(tasks);
});

router.patch("/:taskId/status", auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: "Status required" });
    if (!taskId) return res.status(400).json({ error: "Task ID required" });

    const { id: userId, role, tenantId } = req.user!;

    // 🔒 Fetch task WITH tenant check
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const isOwner = task.assigneeId === userId;
    const isManager = role === "MANAGER" || role === "PROJECT_MANAGER";

    if (!isManager && !isOwner) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const newStatus = String(status).toUpperCase();
    if (!Object.values(TaskStatus).includes(newStatus as TaskStatus)) {
      return res.status(400).json({ error: "Invalid task status" });
    }
    console.log("Status Change =>", newStatus);

    // ----------------------------------------
    // 🚫 Restrict multiple WORKING tasks (TENANT SAFE)
    // ----------------------------------------
    const updated = await prisma.$transaction(async (tx) => {
      if (newStatus === "WORKING") {
        await tx.taskWorkLog.updateMany({
          where: { userId, endTime: null },
          data: { endTime: new Date(), isAutoPaused: true },
        });

        await tx.taskWorkLog.create({
          data: {
            taskId,
            userId,
            tenantId,
            startTime: new Date(),
            isAutoPaused: false,
          },
        });
      }

      if (newStatus === "STUCK" || newStatus === "DONE") {
        await tx.taskWorkLog.updateMany({
          where: {
            taskId,
            userId,
            tenantId,
            endTime: null,
          },
          data: { endTime: new Date() },
        });
      }

      if (newStatus === "DONE") {
        await tx.task.update({
          where: { id: taskId },
          data: {
            completedAt: new Date(),
          },
        });
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          status: newStatus as TaskStatus,
          updatedAt: new Date(),
        },
      });
    });


    // ----------------------------------------
    // ✅ Update task (tenant-safe)
    // ----------------------------------------
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus as TaskStatus,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: "Status updated successfully",
      task: updatedTask,
    });

  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.patch("/:id/priority", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!id) return res.status(400).json({ error: "task id required" });
    if (!priority) return res.status(400).json({ error: "priority required" });

    const { id: userId, role, tenantId } = req.user!;

    // 🔒 Fetch task WITH tenant boundary
    const task = await prisma.task.findFirst({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "task not found" });
    }

    const isManager = role === "MANAGER" || role === "PROJECT_MANAGER";
    const isOwner = task.assigneeId === userId;

    if (!isManager && !isOwner) {
      return res.status(403).json({ error: "forbidden" });
    }

    // ✅ Update priority safely
    const updated = await prisma.task.update({
      where: { id },
      data: {
        priority: String(priority).toUpperCase() as any,
        updatedAt: new Date(),
      },
    });

    res.json(updated);

  } catch (err) {
    console.error("Priority Update Error:", err);
    res.status(500).json({ error: "Failed to update priority" });
  }
});

router.post(
  "/:id/transfer",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newAssigneeUserId, newEmployeeId } = req.body;

      if (!id) {
        return res.status(400).json({ error: "task id required" });
      }

      const { tenantId } = req.user!;

      // 🔒 1️⃣ Fetch task within tenant boundary
      const task = await prisma.task.findFirst({
        where: {
          id,
          tenantId,
          isDeleted: false,
        },
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      let assigneeId: string | undefined = newAssigneeUserId;

      // 🔒 2️⃣ Resolve employee → userId (tenant safe)
      if (!assigneeId && newEmployeeId) {
        const emp = await prisma.employee.findFirst({
          where: {
            id: newEmployeeId,
            user: {
              tenantId,
            },
          },
          select: {
            userId: true,
          },
        });

        if (!emp) {
          return res.status(400).json({
            error: "Invalid employee or employee belongs to another tenant",
          });
        }

        assigneeId = emp.userId;
      }

      if (!assigneeId) {
        return res.status(400).json({ error: "assignee required" });
      }

      // 🔒 3️⃣ Verify assignee user belongs to same tenant
      const assigneeUser = await prisma.user.findFirst({
        where: {
          id: assigneeId,
          tenantId,
        },
      });

      if (!assigneeUser) {
        return res.status(400).json({
          error: "Assignee does not belong to your tenant",
        });
      }

      // ✅ 4️⃣ Perform transfer
      const updated = await prisma.task.update({
        where: { id },
        data: {
          assigneeId,
          status: "TODO",
          updatedAt: new Date(),
        },
      });

      res.json(updated);

    } catch (err) {
      console.error("Task Transfer Error:", err);
      res.status(500).json({ error: "Failed to transfer task" });
    }
  }
);

router.delete(
  "/:id",
  auth,
  requireRole("MANAGER", "PROJECT_MANAGER"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: "task id required" });
      }

      const { id: userId, tenantId, role } = req.user!;

      // 🔒 1️⃣ Fetch task within tenant boundary
      const task = await prisma.task.findFirst({
        where: {
          id,
          tenantId,
          isDeleted: false,
        },
      });

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // 🔒 2️⃣ Authorization rules
      const isCreator = task.createdById === userId;
      const isManager =
        role === "MANAGER" || role === "PROJECT_MANAGER";

      if (!isCreator && !isManager) {
        return res.status(403).json({
          message: "Not authorized to delete this task",
        });
      }

      // ✅ 3️⃣ Soft delete
      await prisma.task.update({
        where: { id },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      });

      res.status(200).json({ message: "Task deleted successfully" });

    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  }
);

router.get(
  "/Dashboard",
  auth,
  requireRole("OPERATOR"),
  async (req, res) => {
    try {
      const { id: userId, tenantId } = req.user!;

      console.log("tenatid: ", req.user?.id)

      if (!userId || !tenantId) {
        return res.status(400).json({ message: "Invalid user context" });
      }

      // 🔒 Tenant-safe task fetch
      const tasks = await prisma.task.findMany({
        where: {
          assigneeId: userId,
          tenantId,
          isDeleted: false,
        },
        orderBy: { dueDate: "asc" },
      });

      // ---------- STATS ----------
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === "DONE").length;
      const pendingTasks = tasks.filter(t => t.status === "TODO").length;
      const inProgressTasks = tasks.filter(t => t.status === "WORKING").length;
      const stuckTasks = tasks.filter(t => t.status === "STUCK").length;

      const completionRate =
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0;

      // ---------- COMPLETION TREND ----------
      const completionTrend: any[] = [];
      const now = new Date();

      for (let i = 3; i >= 0; i--) {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - i * 7);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const weekTasks = tasks.filter(
          t =>
            t.updatedAt >= startOfWeek &&
            t.updatedAt <= endOfWeek
        );

        const completedThisWeek = weekTasks.filter(
          t => t.status === "DONE"
        ).length;

        const rate =
          weekTasks.length > 0
            ? Math.round((completedThisWeek / weekTasks.length) * 100)
            : 0;

        completionTrend.push({
          week: `Wk ${startOfWeek.getWeekNumber()}`,
          rate,
        });
      }

      // ---------- RESPONSE ----------
      res.json({
        tasks,
        stats: {
          totalTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks,
          stuckTasks,
          completionRate,
          completionTrend,
        },
      });

    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// manager

router.get(
  "/dashboard/manager",
  auth,
  requireRole("MANAGER"),
  async (req, res) => {
    try {
      const { id: managerId, tenantId } = req.user!;

      if (!managerId || !tenantId) {
        return res.status(400).json({ message: "Invalid user context" });
      }

      /* ---------------- EMPLOYEES ---------------- */
      const employees = await prisma.employee.findMany({
        where: {
          managerId,
          tenantId,
        },
        select: {
          userId: true,
          status: true,
        },
      });

      const employeeIds = employees.map(e => e.userId);

      const totalEmployees = employees.length;
      const activeEmployees = employees.filter(
        e => e.status === "Active"
      ).length;

      /* ---------------- TASKS ---------------- */
      const tasks = await prisma.task.findMany({
        where: {
          createdById: managerId,
          tenantId,
          isDeleted: false,
        },
        select: {
          status: true,
          assignedHours: true,
          updatedAt: true,
        },
      });

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === "DONE").length;
      const inProgressTasks = tasks.filter(t => t.status === "WORKING").length;
      const pendingTasks = tasks.filter(t => t.status === "TODO").length;

      const completionRate =
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0;

      /* ---------------- TODAY ASSIGNED HOURS ---------------- */
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayAssignedHours = tasks
        .filter(t => t.updatedAt >= today)
        .reduce((sum, t) => sum + (t.assignedHours || 0), 0);

      /* ---------------- RESPONSE ---------------- */
      res.json({
        cards: {
          totalEmployees,
          activeEmployees,
          totalTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks,
          todayAssignedHours,
          completionRate,
        },
      });
    } catch (error) {
      console.error("Manager dashboard error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// project manager

router.get(
  "/dashboard/project-manager",
  auth,
  requireRole("PROJECT_MANAGER"),
  async (req, res) => {
    const { tenantId } = req.user!;

    /* ---------------- Employees ---------------- */
    const totalEmployees = await prisma.employee.count({
      where: { tenantId },
    });

    const activeEmployees = await prisma.employee.count({
      where: { tenantId, status: "Active" },
    });

    /* ---------------- Tasks ---------------- */
    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        isDeleted: false,
      },
      select: {
        status: true,
        assignedHours: true,
      },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === "DONE").length;
    const inProgressTasks = tasks.filter(t => t.status === "WORKING").length;

    const totalAssignedHours = tasks.reduce(
      (sum, t) => sum + (t.assignedHours || 0),
      0
    );

    res.json({
      cards: {
        totalEmployees,
        activeEmployees,
        totalTasks,
        completedTasks,
        inProgressTasks,
        totalAssignedHours,
        completionRate:
          totalTasks > 0
            ? Math.round((completedTasks / totalTasks) * 100)
            : 0,
      },
    });
  }
);

declare global {
  interface Date {
    getWeekNumber(): number;
  }
}

Date.prototype.getWeekNumber = function (): number {
  const d = new Date(
    Date.UTC(this.getFullYear(), this.getMonth(), this.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

// operations

// ----------------------------
// GET: Fetch tasks for employee
// ----------------------------

router.get("/EmployeeTasks", auth, async (req, res) => {
  try {
    const { id: userId, tenantId } = req.user!;

    if (!userId || !tenantId) {
      return res.status(400).json({ error: "Invalid user context" });
    }

    // 🔒 Tenant-safe task fetch
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        tenantId,
        isDeleted: false,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // 📂 Map files from Supabase
    const tasksWithFiles = await Promise.all(
      tasks.map(async (task) => {
        // Manager uploaded files
        const { data: managerFiles } = await supabase.storage
          .from("ManagerFiles")
          .list(task.id, { limit: 10 });

        const managerFileUrls =
          managerFiles?.map(
            (file) =>
              supabase.storage
                .from("ManagerFiles")
                .getPublicUrl(`${task.id}/${file.name}`).data.publicUrl
          ) || [];

        // Employee uploaded files
        const { data: employeeFiles } = await supabase.storage
          .from("OperationsDocuments")
          .list(task.id, { limit: 10 });

        const employeeFileUrls =
          employeeFiles?.map(
            (file) =>
              supabase.storage
                .from("OperationsDocuments")
                .getPublicUrl(`${task.id}/${file.name}`).data.publicUrl
          ) || [];

        return {
          ...task,
          managerFiles: managerFileUrls,
          employeeFiles: employeeFileUrls,
        };
      })
    );

    res.json({ tasks: tasksWithFiles });
  } catch (err) {
    console.error("EmployeeTasks error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});


// GET THE COMPLTED TASK OF THE PARTICULAR EMPLOYEES

router.get("/:employeeId/completed", auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { id: requesterId, role, tenantId } = req.user!;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID required" });
    }

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant context missing" });
    }

    // 1️⃣ Fetch employee + tenant check
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        user: {
          tenantId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found in your tenant",
      });
    }

    // 2️⃣ Authorization check
    const isSelf = employee.userId === requesterId;
    const isManager =
      role === "MANAGER" || role === "PROJECT_MANAGER";

    if (!isSelf && !isManager) {
      return res.status(403).json({
        message: "Not authorized to view this employee's tasks",
      });
    }

    // 3️⃣ Fetch completed tasks (tenant-safe)
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: employee.userId,
        tenantId,
        status: "DONE",
        isDeleted: false,
      },
      include: {
        createdBy: {
          select: {
            email: true,
            role: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ tasks });
  } catch (err) {
    console.error("Completed tasks error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});


// ----------------------------
// PATCH: Update task status
// ----------------------------
// router.patch("/:taskId/status", auth, async (req, res) => {
//   try {
//     const { taskId } = req.params;
//     const { status } = req.body;

//     if (!status) {
//       return res.status(400).json({ error: "Status is required" });
//     }

//     if (!taskId) {
//       return res.status(400).json({ error: "Task ID is required" });
//     }

//     const updatedTask = await prisma.task.update({
//       where: { id: taskId },
//       data: { status, updatedAt: new Date() },
//     });

//     res.json({ message: "Status updated", task: updatedTask });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to update task status" });
//   }
// });

// ----------------------------
// POST: Upload Employee File
// ----------------------------

router.post(
  "/:taskId/upload",
  auth,
  upload.single("file"),
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const file = req.file;
      const { id: userId, role, tenantId } = req.user!;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context missing" });
      }

      if (!taskId) {
        return res.status(400).json({ error: "Task ID is required" });
      }

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // 1️⃣ Fetch task WITH tenant validation
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!task) {
        return res.status(404).json({
          error: "Task not found in your tenant",
        });
      }

      // 2️⃣ Authorization check
      const isAssignee = task.assigneeId === userId;
      const isManager =
        role === "MANAGER" || role === "PROJECT_MANAGER";

      if (!isAssignee && !isManager) {
        return res.status(403).json({
          error: "Not authorized to upload files for this task",
        });
      }

      // 3️⃣ Upload file to Supabase
      const fileName = `${tenantId}/${taskId}/${Date.now()}_${file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from("OperationsDocuments")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("OperationsDocuments")
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // 4️⃣ Update task (tenant-safe)
      await prisma.task.update({
        where: { id: taskId },
        data: {
          fileUrl_operator: publicUrl,
        },
      });

      res.json({
        message: "File uploaded successfully",
        fileUrl: publicUrl,
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Failed to upload file" });
    }
  }
);


export default router;
