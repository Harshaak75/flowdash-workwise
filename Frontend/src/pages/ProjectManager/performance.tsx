"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  User,
  Clock,
  CheckCircle2,
  TrendingUp,
  Target,
  Trophy,
  Zap,
  Loader2,
  Calendar as CalendarIcon,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { Layout } from "@/components/Layout";
import { toast } from "react-hot-toast";

const COLORS = {
  primary: "#0000cc",
  success: "#10b981",
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <Card className="border-none shadow-sm bg-white ring-1 ring-slate-200">
    <CardContent className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-xl font-bold mt-1 text-slate-900">{value}</h3>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function EmployeePerformanceDashboard() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  const [range, setRange] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const token = localStorage.getItem("token");

  const fetchPerformance = useCallback(
    async (id: string, empBase: any, isManualCustom = false) => {
      if (range === "custom" && (!dateFrom || !dateTo)) {
        toast.error("Please select From and To dates");
        return;
      }

      try {
        setLoadingPerformance(true);

        let url = `${API_BASE_URL}/employees/${id}/performance?range=${range}`;
        if (range === "custom") {
          url += `&from=${dateFrom}&to=${dateTo}`;
        }

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setSelectedEmployee({ ...empBase, performance: res.data.performance });
      } catch {
        toast.error("Data Sync Failed");
      } finally {
        setLoadingPerformance(false);
      }
    },
    [range, dateFrom, dateTo, token]
  );
  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/employees/performance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const formatted = res.data.employees.map((e: any) => ({
          ...e,
          role: e.roleTitle || "Staff",
        }));
        setEmployees(formatted);
        if (formatted.length > 0) fetchPerformance(formatted[0].id, formatted[0]);
      } catch (err) {
        toast.error("Initial Load Failed");
      } finally {
        setLoadingList(false);
      }
    };
    init();
  }, [token]);

  useEffect(() => {
    if (selectedEmployee?.id && range !== "custom") {
      fetchPerformance(selectedEmployee.id, selectedEmployee);
    }
  }, [range]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, employees]);

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Team <span className="text-[#0000cc]">Analytics</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Workforce Metrics</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Employees</p>
              <p className="text-lg font-black text-slate-900 leading-none">{employees.length}</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <CalendarIcon className="h-4 w-4 text-[#0000cc]" />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="7d">Last 7 Days</option>
                <option value="14d">Last 14 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Date Input - No Auto Reload */}
        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#0000cc] uppercase ml-1">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#0000cc] uppercase ml-1">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white w-40" />
            </div>
            <Button
              onClick={() => fetchPerformance(selectedEmployee.id, selectedEmployee, true)}
              className="bg-[#0000cc] hover:bg-blue-800 text-white rounded-xl"
            >
              Update Dashboard
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Sidebar */}
          <Card className="lg:col-span-3 border-slate-200 shadow-sm rounded-2xl flex flex-col h-[calc(100vh-250px)] min-h-[600px]">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter team..."
                  className="pl-9 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-[#0000cc]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingList ? (
                <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              ) : (
                filteredEmployees.map((emp: any) => (
                  <button
                    key={emp.id}
                    onClick={() => fetchPerformance(emp.id, emp)}
                    className={`w-full flex items-center p-3 rounded-xl transition-all ${selectedEmployee?.id === emp.id ? 'bg-[#0000cc] text-white' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                  >
                    <User className="h-4 w-4 mr-3" />
                    <div className="text-left">
                      <p className="text-sm font-bold leading-none">{emp.name}</p>
                      <p className="text-[10px] mt-1 opacity-70">{emp.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Performance Dashboard */}
          <div className="lg:col-span-9 space-y-6 relative">
            {loadingPerformance && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-[#0000cc]" />
              </div>
            )}

            {selectedEmployee?.performance ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard title="Active Hours" value={`${selectedEmployee.performance.hours}h`} icon={Clock} color="text-blue-600" />
                  <StatCard title="Task Completion" value={`${selectedEmployee.performance.completionRate}%`} icon={CheckCircle2} color="text-emerald-600" />
                  <StatCard title="Engagement" value={`${selectedEmployee.performance.engagement}%`} icon={TrendingUp} color="text-amber-600" />
                </div>

                {/* row 1: Bar & Line */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="border-slate-200 shadow-sm rounded-2xl p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Zap className="h-3 w-3 text-[#0000cc]" /> Hourly Output</h4>
                    <div className="h-[230px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedEmployee.performance.weeklyHours}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="hours" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="border-slate-200 shadow-sm rounded-2xl p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Target className="h-3 w-3 text-emerald-500" /> Completion Trend</h4>
                    <div className="h-[230px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedEmployee.performance.completionTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="completion" stroke={COLORS.success} strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                {/* row 2: Radar & Skills */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="border-slate-200 shadow-sm rounded-2xl p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Activity className="h-3 w-3 text-red-500" /> Efficiency Radar</h4>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedEmployee.performance.radar}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                          <Radar name="Performance" dataKey="A" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.5} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="border-slate-200 shadow-sm rounded-2xl p-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Skill Proficiency</h4>
                    <div className="space-y-4">
                      {selectedEmployee.performance.skills.map((s: any) => (
                        <div key={s.skill}>
                          <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-700">
                            <span>{s.skill}</span>
                            <span className="text-[#0000cc]">{s.percentage}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div className="h-full bg-[#0000cc]" style={{ width: `${s.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Milestones */}
                <Card className="border-slate-200 shadow-sm rounded-2xl p-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Recent Achievements</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedEmployee.performance.achievements.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-none">{a.title}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{a.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl text-slate-300">
                <p>Select a member to view full analytics</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}