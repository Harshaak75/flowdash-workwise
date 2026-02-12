"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportQueue = exports.connection = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const email_1 = require("./email");
exports.connection = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
let isRedisDown = false;
exports.connection.on("error", async (err) => {
    // Only handle ECONNREFUSED for downtime tracking specifically
    if (err.code === "ECONNREFUSED") {
        if (!isRedisDown) {
            isRedisDown = true;
            console.error("Redis Connection Lost (ECONNREFUSED). Sending alert.");
            await (0, email_1.sendWorkerErrorEmail)("Redis Connection", err, { context: "Global Redis Connection Failed. Will notify when back up." });
        }
    }
    else {
        // Log other errors but don't spam email
        console.error("Redis Connection Error:", err);
    }
});
exports.connection.on("ready", async () => {
    if (isRedisDown) {
        isRedisDown = false;
        console.log("Redis Connection Restored. Sending recovery email.");
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        if (adminEmail) {
            await (0, email_1.sendEmail)({
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
exports.reportQueue = new bullmq_1.Queue("report-generation", {
    connection: exports.connection,
});
//# sourceMappingURL=queue.js.map