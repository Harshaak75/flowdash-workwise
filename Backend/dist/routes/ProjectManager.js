"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("@supabase/supabase-js");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
router.get("/ManagerTasks", auth_1.auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const role = req.user?.role;
        if (!userId || !tenantId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // 🔐 Only MANAGER / PROJECT_MANAGER allowed
        if (role !== "MANAGER" && role !== "PROJECT_MANAGER") {
            return res.status(403).json({ error: "Forbidden" });
        }
        // 1️⃣ Fetch tasks CREATED BY this PM within SAME TENANT
        // const tasks = await prisma.task.findMany({
        //   where: {
        //     createdById: userId,
        //     tenantId,               // 🔐 CRITICAL MULTI-TENANT FILTER
        //     isDeleted: false,
        //   },
        //   include: {
        //     createdBy: {
        //       select: { id: true, email: true, role: true },
        //     },
        //     assignee: {
        //       select: { id: true, email: true },
        //     },
        //   },
        //   orderBy: { dueDate: "asc" },
        // });
        const tasks = await db_1.default.task.findMany({
            where: {
                assigneeId: userId, // ✅ FIX
                tenantId,
                isDeleted: false,
            },
            include: {
                createdBy: { select: { id: true, email: true, role: true } },
                assignee: { select: { id: true, email: true } },
            },
            orderBy: { dueDate: "asc" },
        });
        // 2️⃣ Map files from Supabase
        const tasksWithFiles = await Promise.all(tasks.map(async (task) => {
            // Project Manager uploaded files
            const { data: managerFiles } = await supabase.storage
                .from("projectManagerFiles")
                .list(task.id, { limit: 10 });
            const managerFileUrls = managerFiles?.map((file) => supabase.storage
                .from("projectManagerFiles")
                .getPublicUrl(`${task.id}/${file.name}`).data.publicUrl) || [];
            // Manager-added documents
            const { data: employeeFiles } = await supabase.storage
                .from("ManagerAddedDocuments")
                .list(task.id, { limit: 10 });
            const employeeFileUrls = employeeFiles?.map((file) => supabase.storage
                .from("ManagerAddedDocuments")
                .getPublicUrl(`${task.id}/${file.name}`).data.publicUrl) || [];
            return {
                ...task,
                managerFiles: managerFileUrls,
                employeeFiles: employeeFileUrls,
            };
        }));
        res.json({ tasks: tasksWithFiles });
    }
    catch (err) {
        console.error("❌ ManagerTasks error:", err);
        res.status(500).json({ error: "Failed to fetch manager tasks" });
    }
});
router.get("/Manager_employee_list", auth_1.auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // 🔐 Fetch employees under this manager within SAME TENANT
        const employees = await db_1.default.employee.findMany({
            where: {
                managerId: userId,
                user: {
                    tenantId, // 🔐 tenant isolation
                },
            },
            select: {
                id: true,
                name: true,
                roleTitle: true,
                department: true,
                status: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });
        res.status(200).json({ employees });
    }
    catch (error) {
        console.error("❌ Manager_employee_list error:", error);
        res.status(500).json({ error: "Failed to fetch employees" });
    }
});
router.get("/employee-assign/new-joiners", auth_1.auth, (0, role_1.requireRole)("PROJECT_MANAGER"), // only PM can see this
async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const newJoiners = await db_1.default.employee.findMany({
            where: {
                managerId: null, // not assigned to any manager
                user: {
                    role: "OPERATOR",
                    tenantId, // 🔐 tenant isolation
                },
            },
            select: {
                id: true,
                name: true,
                roleTitle: true,
                department: true,
                status: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        res.status(200).json({ newJoiners });
    }
    catch (error) {
        console.error("❌ New joiners fetch error:", error);
        res.status(500).json({ error: "Failed to fetch new joiners" });
    }
});
router.post("/employee-assign/assign", auth_1.auth, (0, role_1.requireRole)("PROJECT_MANAGER"), async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // 1️⃣ Input
        const { employeeId, managerUserId, name, department } = req.body;
        if (!employeeId || !managerUserId) {
            return res.status(400).json({
                error: "employeeId and managerUserId are required",
            });
        }
        // 2️⃣ Validate Manager (same tenant + valid role)
        const managerUser = await db_1.default.user.findFirst({
            where: {
                id: managerUserId,
                tenantId, // 🔐 tenant isolation
                role: { in: ["MANAGER", "PROJECT_MANAGER"] },
            },
        });
        if (!managerUser) {
            return res.status(404).json({
                error: "Manager not found or not in your tenant",
            });
        }
        // 3️⃣ Validate Employee (same tenant, OPERATOR, unassigned)
        const employee = await db_1.default.employee.findFirst({
            where: {
                id: employeeId,
                managerId: null, // 🔐 prevent reassignment
                user: {
                    role: "OPERATOR",
                    tenantId, // 🔐 tenant isolation
                },
            },
            include: {
                user: true,
            },
        });
        if (!employee) {
            return res.status(404).json({
                error: "Employee not found, already assigned, or not in your tenant",
            });
        }
        // 4️⃣ Assign employee + optional updates
        const updatedEmployee = await db_1.default.employee.update({
            where: { id: employeeId },
            data: {
                managerId: managerUserId,
                name: name?.trim() || employee.name,
                department: department?.trim() || employee.department,
            },
        });
        // 5️⃣ (Optional but RECOMMENDED) Notify manager
        // await prisma.notification.create({
        //   data: {
        //     tenantId,
        //     userId: managerUserId,
        //     title: "New Employee Assigned",
        //     message: `${updatedEmployee.name} has been assigned to you.`,
        //   },
        // });
        res.status(200).json({
            message: "Employee assigned successfully",
            employee: updatedEmployee,
        });
    }
    catch (error) {
        console.error("❌ Employee assignment error:", error);
        res.status(500).json({ error: "Failed to assign employee" });
    }
});
router.get("/managers", auth_1.auth, (0, role_1.requireRole)("PROJECT_MANAGER"), async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const managers = await db_1.default.user.findMany({
            where: {
                tenantId,
                role: "MANAGER",
            },
            select: {
                id: true,
                email: true,
                // 🔥 THIS IS THE KEY FIX
                Employee: {
                    select: {
                        name: true,
                        department: true,
                    },
                },
                // 🔥 TEAM MEMBERS UNDER THIS MANAGER
                ManagerEmployees: {
                    select: {
                        id: true,
                        name: true,
                        department: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                email: "asc",
            },
        });
        res.json({
            managers: managers.map((m) => ({
                id: m.id,
                name: m.Employee?.name ?? m.email,
                department: m.Employee?.department ?? null,
                email: m.email,
                teamSize: m.ManagerEmployees.length,
                teamMembers: m.ManagerEmployees, // ✅ employees under manager
            })),
        });
    }
    catch (err) {
        console.error("❌ Fetch managers error:", err);
        res.status(500).json({ error: "Failed to fetch managers" });
    }
});
exports.default = router;
//# sourceMappingURL=ProjectManager.js.map