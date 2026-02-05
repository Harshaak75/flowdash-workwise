"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportQueue = exports.connection = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
exports.connection = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
exports.reportQueue = new bullmq_1.Queue("report-generation", {
    connection: exports.connection,
});
//# sourceMappingURL=queue.js.map