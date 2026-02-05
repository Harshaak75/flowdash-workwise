import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Users,
  Clock,
  CheckCircle2,
  Calendar,
  Download,
  FileBadge,
  TrendingUp,
  Plus,
  Zap,
  Clock4,
  CheckSquare,
} from "lucide-react";
import axios from "axios";

// --- Colors based on inspiration ---
const COLOR_PRIMARY = "#0000cc"; // Blue
const COLOR_ACCENT_ICON = "text-red-500"; // Red
const COLOR_SUCCESS = "#10b981"; // Green for completion
const COLOR_WARNING = "#f97316"; // Orange for hours/pending

// --- Mock Data Structures & Data (Unchanged) ---
interface ReportSummary {
  totalReports: number;
  teamMembers: number;
  totalHours: number;
  completionRate: number;
}

interface ReportItem {
  id: string;
  title: string;
  type: "WEEKLY" | "MONTHLY" | "CUSTOM";
  fromDate: string;
  toDate: string;
  status: "READY" | "GENERATING";
  pdfUrl?: string;
  excelUrl?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- Sub-Component: Report Stat Card (Responsive updates applied) ---
const ReportStatCard = ({
  icon: Icon,
  title,
  value,
  trend,
  colorClass,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  trend: string;
  colorClass: string;
}) => (
  // Reduced padding on mobile (p-4)
  <Card className="p-4 sm:p-5 flex flex-col justify-between h-full border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center justify-between mb-2 sm:mb-3">
      {/* Icon: Smaller on mobile */}
      <div className={`rounded-lg p-2 sm:p-3 bg-[${COLOR_PRIMARY}]/10`}>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${COLOR_ACCENT_ICON}`} />
      </div>
      <p
        className={`text-xs sm:text-sm font-medium ${ // Smaller trend text
          trend.includes("+") ? "text-green-600" : "text-gray-500"
          }`}
      >
        {trend}
      </p>
    </div>
    <div className="space-y-1">
      <p className="text-xs sm:text-sm font-medium text-gray-500">{title}</p>
      {/* Value: Reduced size on mobile */}
      <h3 className="text-2xl sm:text-3xl font-bold" style={{ color: COLOR_PRIMARY }}>
        {value}
      </h3>
    </div>
  </Card>
);

// --- Main Component ---

export default function TeamReportsDashboard() {
  const [role, setRole] = useState<"MANAGER" | "PROJECT_MANAGER" | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const meRes = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setRole(meRes.data.role);

        // These will be real APIs later
        const summaryRes = await axios.get(`${API_BASE_URL}/reports/reports/summary`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const reportsRes = await axios.get(`${API_BASE_URL}/reports/reports`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setSummary(summaryRes.data);
        setReports(reportsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const isManager = role === "MANAGER";
  const isProjectManager = role === "PROJECT_MANAGER";

  // Custom Badge for status consistency
  const getReportStatusBadge = (status: ReportItem["status"]) => {
    if (status === "READY") {
      return (
        <Badge className="bg-green-100 text-green-700 gap-1 text-xs sm:text-sm">
          <CheckCircle2 className="h-3 w-3" /> Ready
        </Badge>
      );
    }

    return (
      <Badge className="bg-amber-100 text-amber-700 gap-1 animate-pulse text-xs sm:text-sm">
        <Clock4 className="h-3 w-3" /> Generating
      </Badge>
    );
  };

  // Custom Badge for report type
  const getReportTypeBadge = (type: ReportItem["type"]) => {
    let typeClass = "bg-gray-100 text-gray-700";

    if (type === "MONTHLY") typeClass = "bg-[#0000cc]/10 text-[#0000cc]";
    if (type === "CUSTOM") typeClass = "bg-red-100 text-red-700";
    if (type === "WEEKLY") typeClass = "bg-green-100 text-green-700";

    return (
      <Badge
        variant="secondary"
        className={`mr-2 text-[10px] sm:text-xs h-4 sm:h-5 font-semibold ${typeClass}`}
      >
        {type}
      </Badge>
    );
  };


const generateReport = async (type: "WEEKLY" | "MONTHLY" | "CUSTOM") => {
  try {
    const toDate = new Date();
    const fromDate = new Date();

    if (type === "WEEKLY") {
      fromDate.setDate(toDate.getDate() - 7);
    }

    if (type === "MONTHLY") {
      fromDate.setMonth(toDate.getMonth() - 1);
    }

    await axios.post(
      `${API_BASE_URL}/reports/reports/generate`,
      {
        type,
        fromDate,
        toDate,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    console.error("Generate report failed", error);
  }
};



  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-gray-500">Loading reports...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 min-h-screen">
        {/* Header and Controls - Responsive Stack */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-3 sm:pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: COLOR_PRIMARY }}>
              Reports & Analytics
            </h1>
            <p className="text-sm sm:text-base text-gray-500">
              Generate and manage comprehensive team performance reports.
            </p>
          </div>
          {/* Button Group - Full width on mobile, stacked on two rows */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-0 w-full sm:w-auto">
            <Button
              variant="outline"
              className={`gap-2 border-[${COLOR_PRIMARY}] text-[${COLOR_PRIMARY}] hover:bg-[#0000cc]/5 text-sm h-9 w-full sm:w-auto`}
            >
              <Plus className={`h-4 w-4 ${COLOR_ACCENT_ICON}`} />
              Generate Quick Report
            </Button>
            <Button
              className={`gap-2 bg-[${COLOR_PRIMARY}] hover:bg-[#0000cc]/90 text-white shadow-md text-sm h-9 w-full sm:w-auto`}
            >
              <FileText className={`h-4 w-4 ${COLOR_ACCENT_ICON}`} />
              Download All Ready
            </Button>
          </div>
        </div>

        {/* Summary Stats - Responsive Grid (2 columns on mobile, 4 on desktop) */}
        {summary && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            <ReportStatCard
              icon={FileText}
              title="Reports Generated"
              value={summary.totalReports.toString()}
              trend=""
              colorClass=""
            />

            {isManager && (
              <ReportStatCard
                icon={Users}
                title="Team Members"
                value={summary.teamMembers.toString()}
                trend=""
                colorClass=""
              />
            )}

            {/* <ReportStatCard
              icon={Clock}
              title="Total Hours Logged"
              value={`${summary.totalHours}h`}
              trend=""
              colorClass=""
            /> */}

            <ReportStatCard
              icon={CheckCircle2}
              title="Completion Rate"
              value={`${summary.completionRate}%`}
              trend=""
              colorClass=""
            />
          </div>
        )}

        {/* Available Reports Section - Responsive design for list items */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>
              Generated reports available for download
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {reports.length === 0 && (
              <p className="text-sm text-gray-500">No reports generated yet.</p>
            )}

            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between border p-4 rounded-lg"
              >
                <div>
                  <h4 className="font-semibold">{report.title}</h4>
                  <p className="text-xs text-gray-500">
                    {report.type} • {report.fromDate} → {report.toDate}
                  </p>
                </div>

                <div className="flex gap-2">
                  {report.status === "READY" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => window.open(report.pdfUrl, "_blank")}
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(report.excelUrl, "_blank")}
                      >
                        Excel
                      </Button>
                    </>
                  ) : (
                    <Badge className="animate-pulse">Generating</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>


        {/* Report Generation Options - Responsive Grid (1 column on mobile, 3 on desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Button onClick={() => generateReport("WEEKLY")}>
            Generate Weekly
          </Button>

          <Button onClick={() => generateReport("MONTHLY")}>
            Generate Monthly
          </Button>

          {isManager && (
            <Button onClick={() => generateReport("CUSTOM")}>
              Create Custom
            </Button>
          )}
        </div>

      </div>
    </Layout>
  );
}