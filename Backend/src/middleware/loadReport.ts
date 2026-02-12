import prisma from "../db";

export async function loadReport(req, res, next) {
  const { reportId } = req.params;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    return res.status(404).json({ message: "Report not found" });
  }

  req.report = report;
  next();
}
