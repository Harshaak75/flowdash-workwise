import { Router } from "express";
import { requireRole } from "../middleware/role.js";
import { auth } from "../middleware/auth.js";

import prisma from "../db";

const router = Router();

// Get a specific board by ID (with access control)
router.get("/board/:boardId", auth, async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if(!boardId){
      return res.status(400).json({ error: "Board ID is required" });
    }

    // Fetch the board
    const board = await prisma.kanbanBoard.findFirst({
      where: {
        id: boardId,
        tenantId, // 🔐 CRITICAL: Ensure board belongs to same tenant
      },
      include: {
        columns: {
          orderBy: { order: "asc" },
          include: {
            issues: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    // 🔐 Access Control
    if (role === "PROJECT_MANAGER") {
      // Project managers can access all boards in their tenant
      return res.json(board);
    } else if (role === "MANAGER") {
      // Managers can only access their department's board
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { department: true },
      });

      if (!employee?.department) {
        return res.status(403).json({
          error: "Department not assigned. Please contact administrator."
        });
      }

      if (board.department !== employee.department) {
        return res.status(403).json({
          error: "Access denied. You can only view your department's board."
        });
      }

      return res.json(board);
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch (err) {
    console.error("❌ Get board failed:", err);
    res.status(500).json({ error: "Failed to fetch board" });
  }
});

// Get all accessible boards for the current user
router.get("/boards", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let boards: any = [];

    if (role === "PROJECT_MANAGER") {
      // 🔐 Project managers can see:
      // 1. Their own personal board (department = null, ownerId = userId)
      // 2. All department boards in the tenant
      boards = await prisma.kanbanBoard.findMany({
        where: {
          tenantId,
          OR: [
            { ownerId: userId, department: null }, // Their personal board
            { department: { not: null } }, // All department boards
          ],
        },
        include: {
          columns: {
            orderBy: { order: "asc" },
            include: {
              issues: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
        orderBy: [
          { department: "asc" },
          { name: "asc" },
        ],
      });

      // If no personal board exists, create one
      const hasPersonalBoard = boards.some(b => b.ownerId === userId && !b.department);
      if (!hasPersonalBoard) {
        const personalBoard = await prisma.kanbanBoard.create({
          data: {
            name: "Project Manager Board",
            scope: "PERSONAL",
            tenantId,
            ownerId: userId,
            department: null,
            columns: {
              create: [
                { title: "Backlog", order: 1 },
                { title: "In Progress", order: 2 },
                { title: "Review", order: 3 },
                { title: "Done", order: 4 },
              ],
            },
          },
          include: {
            columns: {
              orderBy: { order: "asc" },
              include: { issues: true },
            },
          },
        });
        boards.unshift(personalBoard);
      }
    } else if (role === "MANAGER") {
      // 🔐 Managers can only see their department's board
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { department: true },
      });

      if (!employee?.department) {
        return res.status(403).json({
          error: "Department not assigned. Please contact administrator."
        });
      }

      boards = await prisma.kanbanBoard.findMany({
        where: {
          tenantId,
          department: employee.department,
        },
        include: {
          columns: {
            orderBy: { order: "asc" },
            include: {
              issues: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      // If no department board exists, create one
      if (boards.length === 0) {
        const departmentBoard = await prisma.kanbanBoard.create({
          data: {
            name: `${employee.department} Board`,
            scope: "DEPARTMENT",
            tenantId,
            ownerId: userId,
            department: employee.department,
            columns: {
              create: [
                { title: "Backlog", order: 1 },
                { title: "In Progress", order: 2 },
                { title: "Review", order: 3 },
                { title: "Done", order: 4 },
              ],
            },
          },
          include: {
            columns: {
              orderBy: { order: "asc" },
              include: { issues: true },
            },
          },
        });
        boards.push(departmentBoard);
      }
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(boards);
  } catch (err) {
    console.error("❌ Get boards failed:", err);
    res.status(500).json({ error: "Failed to fetch boards" });
  }
});

router.post("/column", auth, async (req, res) => {
  try {
    console.log("🧱 CREATE COLUMN HIT", req.body);

    const { title, boardId } = req.body;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!boardId) {
      return res.status(400).json({ error: "Board ID is required" });
    }

    // 🔐 Only managers can create columns
    if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 1️⃣ Verify board exists and user has access
    const board = await prisma.kanbanBoard.findFirst({
      where: {
        id: boardId,
        tenantId, // 🔐 CRITICAL
      },
    });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    // 2️⃣ Verify access based on role
    if (role === "MANAGER") {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { department: true },
      });

      if (!employee?.department) {
        return res.status(403).json({
          error: "Department not assigned. Please contact administrator."
        });
      }

      if (board.department !== employee.department) {
        return res.status(403).json({
          error: "Access denied. You can only modify your department's board."
        });
      }
    }
    // PROJECT_MANAGER can access all boards, no additional check needed

    // 3️⃣ Compute order safely (per board)
    const order = await prisma.kanbanColumn.count({
      where: {
        boardId: board.id,
      },
    });

    // 4️⃣ Create column
    const column = await prisma.kanbanColumn.create({
      data: {
        title: title.trim(),
        order,
        boardId: board.id,
      },
    });

    res.json(column);
  } catch (err) {
    console.error("❌ Create column failed:", err);
    res.status(500).json({ error: "Failed to create column" });
  }
});

router.put("/column/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!id) {
      return res.status(400).json({ error: "Column ID is required" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!tenantId) {
      return res.status(401).json({ error: "Tenant not found" });
    }

    // 🔐 Only managers can rename columns
    if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 1️⃣ Verify column belongs to this tenant
    const column = await prisma.kanbanColumn.findFirst({
      where: {
        id,
        board: {
          tenantId, // 🔐 CRITICAL
        },
      },
    });

    if (!column) {
      return res.status(404).json({ error: "Column not found" });
    }

    // 2️⃣ Update column
    const updated = await prisma.kanbanColumn.update({
      where: { id: column.id },
      data: {
        title: title.trim(),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("❌ Update column failed:", err);
    res.status(500).json({ error: "Failed to update column" });
  }
});

router.delete("/column/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!id) {
      return res.status(400).json({ error: "Column ID is required" });
    }

    if (!tenantId) {
      return res.status(401).json({ error: "Tenant not found" });
    }

    // 🔐 Only managers can delete columns
    if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 1️⃣ Ensure column belongs to the same tenant
    const column = await prisma.kanbanColumn.findFirst({
      where: {
        id,
        board: {
          tenantId, // 🔐 CRITICAL tenant isolation
        },
      },
      include: {
        issues: true,
      },
    });

    if (!column) {
      return res.status(404).json({ error: "Column not found" });
    }

    // 2️⃣ Prevent deleting column with issues (recommended)
    if (column.issues.length > 0) {
      return res.status(409).json({
        error: "Column contains issues. Move them before deleting.",
      });
    }

    // 3️⃣ Delete column
    await prisma.kanbanColumn.delete({
      where: { id: column.id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete column failed:", err);
    res.status(500).json({ error: "Failed to delete column" });
  }
});

router.post("/issue", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔐 Only MANAGER / PROJECT_MANAGER can create issues
    if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      content,
      priority,
      time,
      assignee,
      columnId,
    } = req.body;

    if (!content || !columnId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Validate column belongs to SAME TENANT
    const column = await prisma.kanbanColumn.findFirst({
      where: {
        id: columnId,
        board: {
          tenantId, // 🔐 CRITICAL
        },
      },
    });

    if (!column) {
      return res.status(404).json({ error: "Invalid column" });
    }

    // 2️⃣ Create issue (tenant-safe)
    const issue = await prisma.kanbanIssue.create({
      data: {
        title: content,
        priority: priority ?? "MEDIUM",
        estimate: time ?? null,
        assigneeName: assignee ?? null,
        columnId: column.id,
        createdBy: userId,
        tenantId, // 🔐 REQUIRED for multi-tenant safety
      },
    });

    res.status(201).json(issue);
  } catch (err) {
    console.error("❌ Create issue failed:", err);
    res.status(500).json({ error: "Failed to create issue" });
  }
});

router.put("/issue/move", auth, async (req, res) => {
  try {
    console.log("🔥 MOVE ROUTE HIT", req.body);

    const { issueId, columnId } = req.body;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔐 Only MANAGER / PROJECT_MANAGER can move issues
    if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!issueId || !columnId) {
      return res.status(400).json({ error: "Missing issueId or columnId" });
    }

    // 🛑 Ignore temp IDs (optimistic UI)
    if (issueId.startsWith("temp-")) {
      return res.json({ ignored: true });
    }

    // 1️⃣ Validate issue belongs to same tenant
    const issue = await prisma.kanbanIssue.findFirst({
      where: {
        id: issueId,
        tenantId, // 🔐 CRITICAL
      },
      select: { id: true },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    // 2️⃣ Validate target column belongs to same tenant
    const column = await prisma.kanbanColumn.findFirst({
      where: {
        id: columnId,
        board: {
          tenantId, // 🔐 CRITICAL
        },
      },
      select: { id: true },
    });

    if (!column) {
      return res.status(404).json({ error: "Invalid column" });
    }

    // 3️⃣ Move issue
    await prisma.kanbanIssue.update({
      where: { id: issueId },
      data: { columnId: column.id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Kanban issue move failed:", err);
    res.status(500).json({ error: "Failed to move issue" });
  }
});

router.put("/issue/:id", auth, async (req, res) => {
  try {
    const issueId = req.params.id;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔐 Only managers can update issues
    if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!issueId) {
      return res.status(400).json({ error: "Invalid issue ID" });
    }

    const { content, priority, time, assignee } = req.body;

    // 1️⃣ Validate issue belongs to tenant
    const issue = await prisma.kanbanIssue.findFirst({
      where: {
        id: issueId,
        tenantId, // 🔐 CRITICAL
      },
      select: { id: true },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    // 2️⃣ Build update payload safely
    const updateData: any = {};

    if (content !== undefined) updateData.title = content;
    if (priority !== undefined) updateData.priority = priority;
    if (time !== undefined) updateData.estimate = time;
    if (assignee !== undefined) updateData.assigneeName = assignee;

    // 3️⃣ Update issue
    const updatedIssue = await prisma.kanbanIssue.update({
      where: { id: issueId },
      data: updateData,
    });

    res.json(updatedIssue);
  } catch (err) {
    console.error("❌ Update issue failed:", err);
    res.status(500).json({ error: "Failed to update issue" });
  }
});

router.delete("/issue/:id", auth, async (req, res) => {
  try {
    const issueId = req.params.id;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔐 Only managers can delete issues
    if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!issueId) {
      return res.status(400).json({ error: "Invalid issue ID" });
    }

    // 1️⃣ Verify issue belongs to tenant
    const issue = await prisma.kanbanIssue.findFirst({
      where: {
        id: issueId,
        tenantId, // 🔐 CRITICAL MULTI-TENANT CHECK
      },
      select: { id: true },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    // 2️⃣ Delete issue
    await prisma.kanbanIssue.delete({
      where: { id: issueId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete issue failed:", err);
    res.status(500).json({ error: "Failed to delete issue" });
  }
});
export default router;