import { Worker } from "bullmq";
import { connection } from "../lib/queue";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import prisma from "../db";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import os from "os";

const upload = multer({ storage: multer.memoryStorage() });
const tmpDir = os.tmpdir(); // platform-safe

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase environment variables are not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

new Worker(
  "report-generation",
  async (job) => {
    const { reportId } = job.data;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) throw new Error("Report not found");

    // 1️⃣ Aggregate data (example: hours + tasks)
    const workLogs = await prisma.taskWorkLog.findMany({
      where: {
        user: { tenantId: report.tenantId },
        startTime: { gte: report.fromDate },
        endTime: { lte: report.toDate },
      },
      include: { user: true },
    });

    const rows = workLogs.map((l) => ({
      user: l.user.email,
      hours:
        ((l.endTime!.getTime() - l.startTime.getTime()) / 3600000).toFixed(2),
    }));

    // 2️⃣ Generate PDF
    const pdfPath = path.join(tmpDir, `${report.id}.pdf`);
    const pdf = new PDFDocument();
    pdf.pipe(fs.createWriteStream(pdfPath));
    pdf.text(`${report.type} Report`, { align: "center" });
    rows.forEach((r) => pdf.text(`${r.user} - ${r.hours} hrs`));
    pdf.end();

    // 3️⃣ Generate Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.columns = [
      { header: "Employee", key: "user" },
      { header: "Hours Worked", key: "hours" },
    ];
    sheet.addRows(rows);

    const excelPath = path.join(tmpDir, `${report.id}.xlsx`);
    await workbook.xlsx.writeFile(excelPath);

    // 4️⃣ Upload to Supabase
    const year = report.createdAt.getFullYear();
    const month = String(report.createdAt.getMonth() + 1).padStart(2, "0");

    const basePath = `${report.tenantId}/${year}/${month}/${report.type}`;

    const pdfUpload = await supabase.storage
      .from("reports")
      .upload(`${basePath}/${report.id}.pdf`, fs.readFileSync(pdfPath), {
        contentType: "application/pdf",
        upsert: true,
      });

    const excelUpload = await supabase.storage
      .from("reports")
      .upload(`${basePath}/${report.id}.xlsx`, fs.readFileSync(excelPath), {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    const pdfUrl = supabase.storage
      .from("reports")
      .getPublicUrl(pdfUpload.data!.path).data.publicUrl;

    const excelUrl = supabase.storage
      .from("reports")
      .getPublicUrl(excelUpload.data!.path).data.publicUrl;

    // 5️⃣ Update report
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "READY",
        pdfUrl,
        excelUrl,
      },
    });

    fs.unlinkSync(pdfPath);
    fs.unlinkSync(excelPath);
  },
  { connection }
);
