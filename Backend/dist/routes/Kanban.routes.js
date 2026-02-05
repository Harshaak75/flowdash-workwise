"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
router.get("/board", auth_js_1.auth, async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        return res.status(401).json({ error: "Tenant not found" });
    }
    // 🔐 Fetch tenant-specific board
    let board = await db_1.default.kanbanBoard.findFirst({
        where: {
            tenantId, // 🔐 CRITICAL
            scope: "GLOBAL",
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
    // ✅ CREATE DEFAULT BOARD PER TENANT
    if (!board) {
        board = await db_1.default.kanbanBoard.create({
            data: {
                name: "Main Project Board",
                scope: "GLOBAL",
                tenantId, // 🔐 CRITICAL
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
router.post("/column", auth_js_1.auth, async (req, res) => {
    try {
        console.log("🧱 CREATE COLUMN HIT", req.body);
        const { title } = req.body;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: "Tenant not found" });
        }
        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title is required" });
        }
        // 1️⃣ Find tenant-specific GLOBAL board
        let board = await db_1.default.kanbanBoard.findFirst({
            where: {
                scope: "GLOBAL",
                tenantId, // 🔐 CRITICAL
            },
        });
        // 2️⃣ Create board if not exists (PER TENANT)
        if (!board) {
            board = await db_1.default.kanbanBoard.create({
                data: {
                    name: "Main Kanban Board",
                    scope: "GLOBAL",
                    tenantId, // 🔐 CRITICAL
                },
            });
        }
        // 3️⃣ Compute order safely (per board)
        const order = await db_1.default.kanbanColumn.count({
            where: {
                boardId: board.id,
            },
        });
        // 4️⃣ Create column
        const column = await db_1.default.kanbanColumn.create({
            data: {
                title: title.trim(),
                order,
                boardId: board.id,
            },
        });
        res.json(column);
    }
    catch (err) {
        console.error("❌ Create column failed:", err);
        res.status(500).json({ error: "Failed to create column" });
    }
});
router.put("/column/:id", auth_js_1.auth, async (req, res) => {
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
        const column = await db_1.default.kanbanColumn.findFirst({
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
        const updated = await db_1.default.kanbanColumn.update({
            where: { id: column.id },
            data: {
                title: title.trim(),
            },
        });
        res.json(updated);
    }
    catch (err) {
        console.error("❌ Update column failed:", err);
        res.status(500).json({ error: "Failed to update column" });
    }
});
router.delete("/column/:id", auth_js_1.auth, async (req, res) => {
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
        const column = await db_1.default.kanbanColumn.findFirst({
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
        await db_1.default.kanbanColumn.delete({
            where: { id: column.id },
        });
        res.json({ success: true });
    }
    catch (err) {
        console.error("❌ Delete column failed:", err);
        res.status(500).json({ error: "Failed to delete column" });
    }
});
router.post("/issue", auth_js_1.auth, async (req, res) => {
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
        const { content, priority, time, assignee, columnId, } = req.body;
        if (!content || !columnId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        // 1️⃣ Validate column belongs to SAME TENANT
        const column = await db_1.default.kanbanColumn.findFirst({
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
        const issue = await db_1.default.kanbanIssue.create({
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
    }
    catch (err) {
        console.error("❌ Create issue failed:", err);
        res.status(500).json({ error: "Failed to create issue" });
    }
});
router.put("/issue/move", auth_js_1.auth, async (req, res) => {
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
        const issue = await db_1.default.kanbanIssue.findFirst({
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
        const column = await db_1.default.kanbanColumn.findFirst({
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
        await db_1.default.kanbanIssue.update({
            where: { id: issueId },
            data: { columnId: column.id },
        });
        res.json({ success: true });
    }
    catch (err) {
        console.error("❌ Kanban issue move failed:", err);
        res.status(500).json({ error: "Failed to move issue" });
    }
});
router.put("/issue/:id", auth_js_1.auth, async (req, res) => {
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
        const issue = await db_1.default.kanbanIssue.findFirst({
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
        const updateData = {};
        if (content !== undefined)
            updateData.title = content;
        if (priority !== undefined)
            updateData.priority = priority;
        if (time !== undefined)
            updateData.estimate = time;
        if (assignee !== undefined)
            updateData.assigneeName = assignee;
        // 3️⃣ Update issue
        const updatedIssue = await db_1.default.kanbanIssue.update({
            where: { id: issueId },
            data: updateData,
        });
        res.json(updatedIssue);
    }
    catch (err) {
        console.error("❌ Update issue failed:", err);
        res.status(500).json({ error: "Failed to update issue" });
    }
});
router.delete("/issue/:id", auth_js_1.auth, async (req, res) => {
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
        const issue = await db_1.default.kanbanIssue.findFirst({
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
        await db_1.default.kanbanIssue.delete({
            where: { id: issueId },
        });
        res.json({ success: true });
    }
    catch (err) {
        console.error("❌ Delete issue failed:", err);
        res.status(500).json({ error: "Failed to delete issue" });
    }
});
exports.default = router;
//# sourceMappingURL=Kanban.routes.js.map