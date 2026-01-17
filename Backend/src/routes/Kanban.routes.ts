import { Router } from "express";
import { requireRole } from "../middleware/role.js";
import { auth } from "../middleware/auth.js";

import prisma from "../db";

const router = Router();

router.get("/board", auth, async (req, res) => {
  let board = await prisma.kanbanBoard.findFirst({
    where: { scope: "GLOBAL" },
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

  // ✅ CREATE DEFAULT BOARD IF NOT EXISTS
  if (!board) {
    board = await prisma.kanbanBoard.create({
      data: {
        name: "Main Project Board",
        scope: "GLOBAL",
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
  }

  res.json(board);
});


router.post("/column", auth, async (req, res) => {
  try {
    console.log("🧱 CREATE COLUMN HIT", req.body);

    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    // 1️⃣ Find or create GLOBAL board
    let board = await prisma.kanbanBoard.findFirst({
      where: { scope: "GLOBAL" },
    });

    if (!board) {
      board = await prisma.kanbanBoard.create({
        data: {
          name: "Main Kanban Board",
          scope: "GLOBAL",
        },
      });
    }

    // 2️⃣ Compute order safely
    const order = await prisma.kanbanColumn.count({
      where: { boardId: board.id },
    });

    // 3️⃣ Create column
    const column = await prisma.kanbanColumn.create({
      data: {
        title: title.trim(),
        order,
        board: {
          connect: { id: board.id },
        },
      },
    });

    res.json(column);
  } catch (err) {
    console.error("❌ Create column failed:", err);
    res.status(500).json({ error: "Failed to create section" });
  }
});



// Rename

router.put("/column/:id", auth, async (req, res) => {
  const id = req.params.id;

  if (!id) return res.status(400).json({ error: "Invalid ID" });

  const column = await prisma.kanbanColumn.update({
    where: { id },
    data: { title: req.body.title },
  });

  res.json(column);
});


// Delete

router.delete("/column/:id", auth, async (req, res) => {
  const id = req.params.id;

  if (!id) return res.status(400).json({ error: "Invalid ID" });

  await prisma.kanbanColumn.delete({
    where: { id },
  });

  res.json({ success: true });
});


// CREATE ISSUE

router.post("/issue", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      content,     // from frontend
      priority,
      time,
      assignee,
      columnId,
    } = req.body;

    if (!content || !columnId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const issue = await prisma.kanbanIssue.create({
      data: {
        title: content,              // ✅ FIX
        priority: priority ?? "MEDIUM",
        estimate: time ?? null,
        assigneeName: assignee ?? null,
        columnId,
        createdBy: userId,
      },
    });

    res.json(issue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create issue" });
  }
});

// MOVE ISSUE

router.put("/issue/move", auth, async (req, res) => {
  try {
    console.log("🔥 MOVE ROUTE HIT", req.body);

    const { issueId, columnId } = req.body;

    if (!issueId || !columnId) {
      return res.status(400).json({ error: "Missing issueId or columnId" });
    }

    // 🛑 Ignore temp IDs (optimistic UI)
    if (issueId.startsWith("temp-")) {
      return res.json({ ignored: true });
    }

    // ✅ Check existence using issueId
    const existingIssue = await prisma.kanbanIssue.findUnique({
      where: { id: issueId },
      select: { id: true },
    });

    if (!existingIssue) {
      return res.json({ ignored: true });
    }

    // ✅ IMPORTANT: use issueId here, NOT `id`
    await prisma.kanbanIssue.update({
      where: { id: issueId },
      data: { columnId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Kanban issue move failed:", err);
    res.status(500).json({ error: "Failed to move issue" });
  }
});



// UPDATE ISSUE

router.put("/issue/:id", auth, async (req, res) => {
  const id = req.params.id;

  if (!id) return res.status(400).json({ error: "Invalid ID" });

  const issue = await prisma.kanbanIssue.update({
    where: { id },
    data: {
      title: req.body.content,
      priority: req.body.priority,
      estimate: req.body.time,
      assigneeName: req.body.assignee,
    },
  });

  res.json(issue);
});


// DELETE ISSUE

router.delete("/issue/:id", auth, async (req, res) => {
  const id = req.params.id;

  if (!id) return res.status(400).json({ error: "Invalid ID" });

  await prisma.kanbanIssue.delete({
    where: { id },
  });

  res.json({ success: true });
});








export default router;