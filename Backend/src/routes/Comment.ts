import { Router } from "express";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

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

    // 🔔 NOTIFICATION LOGIC
    let notifyUserId: string | null = null;

    // Determine recipient based on who commented
    if (isManager && task.assigneeId && task.assigneeId !== userId) {
      notifyUserId = task.assigneeId;
    } else if (isAssignee && task.createdById && task.createdById !== userId) {
      notifyUserId = task.createdById;
    } else {
      // Fallback: If some third party (admin/project manager not directly assigned) comments?
      // For now, stick to basic flow: Operator <-> Manager
      if (userId === task.createdById && task.assigneeId) notifyUserId = task.assigneeId;
      else if (userId === task.assigneeId && task.createdById) notifyUserId = task.createdById;
    }

    if (notifyUserId) {
      try {
        await prisma.notification.create({
          data: {
            userId: notifyUserId,
            tenantId,
            type: "TASK_COMMENT",
            title: `New comment: ${task.title ? task.title.substring(0, 20) : "Task"}...`,
            message: content.substring(0, 50),
            resourceId: taskId,
          },
        });
      } catch (notifyErr) {
        console.error("Failed to create notification", notifyErr);
        // Don't fail the request, just log
      }
    }

    res.json(comment);
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


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
