"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadReport = loadReport;
const db_1 = __importDefault(require("../db"));
async function loadReport(req, res, next) {
    const { reportId } = req.params;
    const report = await db_1.default.report.findUnique({
        where: { id: reportId },
    });
    if (!report) {
        return res.status(404).json({ message: "Report not found" });
    }
    req.report = report;
    next();
}
//# sourceMappingURL=loadReport.js.map