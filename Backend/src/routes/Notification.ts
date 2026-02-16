import { Router } from "express";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// GET notifications
router.get("/", auth, async (req, res) => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId, tenantId },
            orderBy: { createdAt: "desc" },
            take: 20, // Limit to recent 20
        });
        res.json(notifications);
    } catch (err) {
        console.error("Fetch notifications error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Mark as read
router.patch("/:id/read", auth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
        return res.status(400).json({ message: "Notification ID is required" });
    }

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        await prisma.notification.updateMany({
            where: { id, userId }, // Ensure user owns it
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark read error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Mark all as read
router.patch("/read-all", auth, async (req, res) => {
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark all read error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
