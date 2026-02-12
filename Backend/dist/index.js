"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const employees_1 = __importDefault(require("./routes/employees"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const Comment_1 = __importDefault(require("./routes/Comment"));
const ProjectManager_1 = __importDefault(require("./routes/ProjectManager"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const Kanban_routes_1 = __importDefault(require("./routes/Kanban.routes"));
const report_1 = __importDefault(require("./routes/report"));
const reportAnalytics_1 = __importDefault(require("./routes/reportAnalytics"));
const reportDownload_1 = __importDefault(require("./routes/reportDownload"));
const app = (0, express_1.default)();
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: ["http://localhost:8080", "http://localhost:8081", "https://flowbit.dotspeaks.com", "http://194.163.139.103:4001", "http://localhost:5000", "http://localhost:8082"], // your frontend origin
    credentials: true, // ✅ allows cookies
}));
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.removeHeader("X-Frame-Options"); // you already had this
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self' http://localhost:8082");
    res.setHeader("Permissions-Policy", "geolocation=(self)");
    next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', auth_1.default);
app.use('/api/employees', employees_1.default);
app.use('/api/tasks', tasks_1.default);
app.use("/api/comments", Comment_1.default);
app.use("/api/projectManager", ProjectManager_1.default);
app.use("/api/kanbanBoard", Kanban_routes_1.default);
app.use("/api/reports", report_1.default);
app.use("/api/reports/analytics", reportAnalytics_1.default);
app.use("/api/reports/download", reportDownload_1.default);
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
//# sourceMappingURL=index.js.map