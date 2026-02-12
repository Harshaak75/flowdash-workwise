import { useState, useCallback, useMemo } from "react";
import { ReportsAPI } from "@/api/reports";
import { usePolling } from "@/hooks/usePolling";
import { EmployeeSelector } from "@/components/reports/EmployeeSelector";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportSkeleton } from "@/components/reports/ReportSkeleton";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { Loader2, FileText, Download, Calendar as CalendarIcon, User, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ReportsDashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true); // Initial skeleton load
  const [refreshing, setRefreshing] = useState(false); // Background refresh
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Generation Type State (for the Generate Button)
  const [generationType, setGenerationType] = useState<"WEEKLY" | "MONTHLY" | "CUSTOM">("WEEKLY");

  // Client-side filtering
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>("ALL");

  const [filters, setFilters] = useState<{
    from?: string;
    to?: string;
    type?: "WEEKLY" | "MONTHLY" | "CUSTOM";
  }>({});

  // Wrapped in useCallback so usePolling can track it
  const loadReports = useCallback(async (currentFilters = filters, isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await ReportsAPI.list(currentFilters);
      setReports(res.data);
    } catch (e) {
      console.error("Failed to load reports", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  // Poll silently every 10s
  usePolling(() => loadReports(filters, true), 10000);

  // Helper to set dates from presets
  const setPreset = (val: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (val === "THIS_WEEK") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
    } else if (val === "LAST_WEEK") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
    } else if (val === "THIS_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (val === "LAST_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const newFilters = {
      ...filters,
      from: start.toISOString().split("T")[0],
      to: end.toISOString().split("T")[0]
    };
    setFilters(newFilters);
    // Auto-apply when preset is selected? Usually yes for UX.
    loadReports(newFilters, false);
  };

  async function downloadTeam(reportId: string) {
    setDownloadingId(`team-${reportId}`);
    try {
      const res = await ReportsAPI.teamPdf(reportId);
      window.open(res.data.url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadEmployee(reportId: string) {
    if (!selectedEmployee) return;
    setDownloadingId(`emp-${reportId}`);
    try {
      const res = await ReportsAPI.employeePdf(reportId, selectedEmployee.id);
      window.open(res.data.url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  }

  async function generateReport() {
    if (!filters.from || !filters.to) {
      alert("Please select date range using the filters above first. (Report Type is selected below)");
      return;
    }

    setGenerating(true);
    try {
      await ReportsAPI.generate({
        type: generationType,
        scope: selectedEmployee ? "EMPLOYEE" : "TEAM",
        fromDate: filters.from,
        toDate: filters.to,
        employeeIds: selectedEmployee ? [selectedEmployee.id] : [],
      });
      // Immediate reload
      loadReports(filters, false);
    } catch (e) {
      console.error(e);
      alert("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  // Client-side filtering logic
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const d = new Date(r.fromDate);
      if (filterYear !== "ALL" && d.getFullYear().toString() !== filterYear) return false;
      if (filterMonth !== "ALL" && d.getMonth().toString() !== filterMonth) return false;
      return true;
    });
  }, [reports, filterYear, filterMonth]);

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <Layout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header & Main Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0000cc]">Reports</h1>
            <p className="text-muted-foreground mt-1">Generate and analyze performance reports.</p>
          </div>

          {/* Top Date Pickers */}
          <ReportFilters
            loading={loading && !refreshing}
            filters={filters}
            setFilters={setFilters}
            onApply={() => loadReports(filters, false)}
          />
        </div>

        {/* Generator Section */}
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Generate New Report
          </h2>
          <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Employee Selector */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Target Audience</label>
                <div className="flex items-center gap-5 rounded-lg border border-dashed h-10">
                  <EmployeeSelector onSelect={setSelectedEmployee} />
                  {selectedEmployee ? (
                    <div className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
                      <User className="w-3 h-3" />
                      {selectedEmployee.email}
                      <button onClick={() => setSelectedEmployee(null)} className="ml-1 hover:text-blue-900">✕</button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic flex items-center gap-1 whitespace-nowrap">
                      <Users className="w-3 h-3" /> Entire Team
                    </span>
                  )}
                </div>
              </div>

              {/* Generation Type Selector
              <div>
                <label className="text-sm font-medium mb-1.5 block">Report Type</label>
                <Select value={generationType} onValueChange={(v: any) => setGenerationType(v)}>
                  <SelectTrigger className="w-full bg-gray-50 h-10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly Report</SelectItem>
                    <SelectItem value="MONTHLY">Monthly Report</SelectItem>
                    <SelectItem value="CUSTOM">Custom Report</SelectItem>
                  </SelectContent>
                </Select>
              </div> */}
            </div>

            <Button
              disabled={loading || generating}
              onClick={generateReport}
              className="w-full lg:w-auto min-w-[160px] h-10"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" /> Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </Button>
          </div>
        </div>

        {/* History Section */}
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row justify-between items-center bg-gray-50/50 p-2 rounded-lg gap-4">
            <h2 className="text-lg font-semibold px-2">Report History ({filteredReports.length})</h2>

            {/* Secondary Filters (Type, Preset, Year, Month) */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Report Type Filter (Backend Filter) */}
              <Select value={filters.type || "ALL"} onValueChange={(t) => {
                const newFilters: any = { ...filters, type: t === "ALL" ? undefined : t };
                setFilters(newFilters);
                loadReports(newFilters, false);
              }}>
                <SelectTrigger className="w-[130px] h-8 bg-white border-dashed text-xs">
                  <SelectValue placeholder="Filter Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>

              {/* Quick Preset (Updates Dates) */}
              <Select onValueChange={setPreset}>
                <SelectTrigger className="w-[130px] h-8 bg-white border-dashed text-xs">
                  <SelectValue placeholder="Quick Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THIS_WEEK">This Week</SelectItem>
                  <SelectItem value="LAST_WEEK">Last Week</SelectItem>
                  <SelectItem value="THIS_MONTH">This Month</SelectItem>
                  <SelectItem value="LAST_MONTH">Last Month</SelectItem>
                </SelectContent>
              </Select>

              <div className="w-px h-6 bg-gray-300 mx-1 hidden md:block"></div>

              {/* Year/Month Client Filters */}
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[90px] h-8 bg-white text-xs">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Years</SelectItem>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[100px] h-8 bg-white text-xs">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Months</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {new Date(0, i).toLocaleString('default', { month: 'short' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <ReportSkeleton />
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-white rounded-xl border border-dashed">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
              No reports found for the selected period.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredReports.map((r) => (
                <Card key={r.id} className="group hover:shadow-md transition-all duration-200 border-l-4" style={{ borderLeftColor: r.scope === 'TEAM' ? '#0000cc' : '#0000cc' }}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className={`${r.scope === 'TEAM' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} mb-2`}>
                        {r.scope}
                      </Badge>
                      {r.status !== "READY" && <Badge variant="secondary" className="animate-pulse">Generating</Badge>}
                    </div>
                    <CardTitle className="text-base font-semibold text-gray-900 leading-tight">
                      Report
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <CalendarIcon className="w-3 h-3" />
                      {new Date(r.fromDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(r.toDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {/* Additional info potential */}
                  </CardContent>
                  <CardFooter className="p-3 bg-gray-50 gap-2">
                    {r.status === "READY" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
                          onClick={() => downloadTeam(r.id)}
                          disabled={!!downloadingId}
                        >
                          {downloadingId === `team-${r.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-1.5" />}
                          Team PDF
                        </Button>

                        {selectedEmployee && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                            onClick={() => downloadEmployee(r.id)}
                            disabled={!!downloadingId}
                          >
                            {downloadingId === `emp-${r.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3 mr-1.5" />}
                            User PDF
                          </Button>
                        )}
                      </>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
