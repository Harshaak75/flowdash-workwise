import { Router } from "express";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// router.post("/:taskId", auth, async (req, res) => {
//   const { taskId } = req.params;
//   const { content } = req.body;
//   const userId = req.user!.id;

//   console.log("Adding comment", { taskId, content, userId });

//   if (!userId) return res.status(401).json({ message: "Unauthorized" });
//   if (!taskId) return res.status(400).json({ message: "Task ID required" });

//   try {
//     // Fetch the task and its creator/assignee
//     const task = await prisma.task.findUnique({
//       where: { id: taskId },
//       include: { createdBy: true, assignee: true },
//     });

//     if (!task) return res.status(404).json({ message: "Task not found" });

//     // Only the manager (createdBy) or assigned operator can comment
//     if (userId !== task.createdById && userId !== task.assigneeId) {
//       return res.status(403).json({ message: "Not authorized" });
//     }

//     const comment = await prisma.taskComment.create({
//       data: {
//         taskId,
//         authorId: userId,
//         content,
//         seenByAssignee: userId === task.createdById ? false : true,
//         seenByManager: userId === task.assigneeId ? false : true,
//       },
//       include: { author: { select: { id: true, email: true, role: true } } },
//     });

//     res.json(comment);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// --- Get all comments for a task ---

router.post("/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;

  const userId = req.user?.id;
  const tenantId = req.user?.tenantId;

  if (!userId || !tenantId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!taskId) {
    return res.status(400).json({ message: "Task ID required" });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Comment content required" });
  }

  try {
    // 🔐 TENANT-SAFE TASK FETCH
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId, // 🔐 CRITICAL
      },
      include: {
        createdBy: true,
        assignee: true,
      },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // 🔐 AUTHORIZATION
    const isManager = userId === task.createdById;
    const isAssignee = userId === task.assigneeId;

    if (!isManager && !isAssignee) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // ✅ CREATE COMMENT (TENANT SAFE)
    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        tenantId, // 🔐 REQUIRED
        authorId: userId,
        content,

        // Seen logic (unchanged, but correct)
        seenByAssignee: isManager ? false : true,
        seenByManager: isAssignee ? false : true,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.json(comment);
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});




// router.get("/:taskId", auth, async (req, res) => {
//   const { taskId } = req.params;
//   const userId = req.user!.id;

//   if (!userId) return res.status(401).json({ message: "Unauthorized" });
//   if (!taskId) return res.status(400).json({ message: "Task ID required" });

//   try {
//     const task = await prisma.task.findUnique({
//       where: { id: taskId },
//       include: { createdBy: true, assignee: true },
//     });

//     if (!task) return res.status(404).json({ message: "Task not found" });

//     // Only manager or assigned operator can see comments
//     if (userId !== task.createdById && userId !== task.assigneeId) {
//       return res.status(403).json({ message: "Not authorized" });
//     }

//     const comments = await prisma.taskComment.findMany({
//       where: { taskId },
//       include: { author: { select: { id: true, email: true, role: true } } },
//       orderBy: { createdAt: "asc" },
//     });

//     res.json(comments);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// --- Mark comments as seen ---

router.get("/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;

  const userId = req.user?.id;
  const tenantId = req.user?.tenantId;

  if (!userId || !tenantId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!taskId) {
    return res.status(400).json({ message: "Task ID required" });
  }

  try {
    // 🔐 TENANT-SAFE TASK FETCH
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId, // 🔐 CRITICAL
        isDeleted: false,
      },
      select: {
        id: true,
        createdById: true,
        assigneeId: true,
      },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // 🔐 AUTHORIZATION CHECK
    const isManager = userId === task.createdById;
    const isAssignee = userId === task.assigneeId;

    if (!isManager && !isAssignee) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // 🔐 TENANT-SAFE COMMENTS FETCH
    const comments = await prisma.taskComment.findMany({
      where: {
        taskId,
        tenantId, // 🔐 CRITICAL
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.json(comments);
  } catch (err) {
    console.error("Fetch comments error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// router.patch("/:taskId/seen", auth, async (req, res) => {
//   const { taskId } = req.params;
//   const userId = req.user!.id;

//   if (!userId) return res.status(401).json({ message: "Unauthorized" });
//   if (!taskId) return res.status(400).json({ message: "Task ID required" });

//   try {
//     const task = await prisma.task.findUnique({ where: { id: taskId } });
//     if (!task) return res.status(404).json({ message: "Task not found" });

//     let updateData: any = {};
//     if (userId === task.assigneeId) updateData = { seenByAssignee: true };
//     else if (userId === task.createdById) updateData = { seenByManager: true };
//     else return res.status(403).json({ message: "Not authorized" });

//     await prisma.taskComment.updateMany({
//       where: { taskId },
//       data: updateData,
//     });

//     res.json({ message: "Comments marked as seen" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


router.patch("/:taskId/seen", auth, async (req, res) => {
  const { taskId } = req.params;

  const userId = req.user?.id;
  const tenantId = req.user?.tenantId;

  if (!userId || !tenantId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!taskId) {
    return res.status(400).json({ message: "Task ID required" });
  }

  try {
    // 🔐 TENANT-SAFE TASK FETCH
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId,       // 🔐 CRITICAL
        isDeleted: false,
      },
      select: {
        id: true,
        createdById: true,
        assigneeId: true,
      },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // 🔐 AUTHORIZATION LOGIC
    let updateData: Record<string, boolean> = {};

    if (userId === task.assigneeId) {
      updateData = { seenByAssignee: true };
    } else if (userId === task.createdById) {
      updateData = { seenByManager: true };
    } else {
      return res.status(403).json({ message: "Not authorized" });
    }

    // 🔐 TENANT-SAFE BULK UPDATE
    await prisma.taskComment.updateMany({
      where: {
        taskId,
        tenantId,   // 🔐 CRITICAL
      },
      data: updateData,
    });

    res.json({ message: "Comments marked as seen" });
  } catch (err) {
    console.error("Mark comments seen error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
