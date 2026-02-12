import { Queue } from "bullmq";
import IORedis from "ioredis";
import { sendWorkerErrorEmail, sendEmail } from "./email";

export const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
});

let isRedisDown: boolean = false;

connection.on("error", async (err) => {
    // Only handle ECONNREFUSED for downtime tracking specifically
    if ((err as any).code === "ECONNREFUSED") {
        if (!isRedisDown) {
            isRedisDown = true;
            console.error("Redis Connection Lost (ECONNREFUSED). Sending alert.");
            await sendWorkerErrorEmail("Redis Connection", err, { context: "Global Redis Connection Failed. Will notify when back up." });
        }
    } else {
        // Log other errors but don't spam email
        console.error("Redis Connection Error:", err);
    }
});

connection.on("ready", async () => {
    if (isRedisDown) {
        isRedisDown = false;
        console.log("Redis Connection Restored. Sending recovery email.");
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        if (adminEmail) {
            await sendEmail({
                to: adminEmail,
                subject: "✅ RECOVERED: Redis Connection Restored",
                html: "<div style='font-family: Arial, sans-serif; color: #333;'>" +
                    "<h2 style='color: #2E7D32;'>System Recovery Alert</h2>" +
                    "<p>The Redis connection has been successfully re-established.</p>" +
                    "<p>The worker processes should resume normal operation.</p>" +
                    "<p style='font-size: 0.8em; color: #777; margin-top: 20px;'>Sent automatically by FlowDash WorkWise Backend.</p>" +
                    "</div>"
            });
        }
    }
});

export const reportQueue = new Queue("report-generation", {
    connection,
});