import { useState, useEffect, ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import {
  Card,
  CardDescription,
  CardTitle,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  TrendingUp,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import axios from "axios";

import { useAuth } from "./AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Interface definitions
interface Task {
  id: string;
  title: string;
  project?: string;
  status: "TODO" | "WORKING" | "STUCK" | "DONE";
  hoursAllocated?: number;
  hoursUsed?: number;
  dueDate?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  isDeleted?: boolean;
}

interface TodayTaskPerformance {
  taskId: string;
  title: string;
  assignedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
  startTime: string;
  endTime: string | null;
  status: string;
}

interface TodayPerformanceSummary {
  totalAssignedMinutes: number;
  totalActualMinutes: number;
  efficiencyPercent: number;
}

interface Stats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  stuckTasks: number;
  completionRate: number;
  completionTrend: { week: string; rate: number }[];
}

// Colors
const COLOR_PRIMARY = "#0000cc"; 
const COLOR_DANGER = "#dc2626";  
const COLOR_SUCCESS = "#059669"; 
const COLOR_WARNING = "#d97706"; 

const StatsCardWrapper = ({ children }: { children: ReactNode }) => (
  <div className="h-full flex flex-col transition-transform duration-200 hover:-translate-y-1">{children}</div>
);

export const getTodayPerformance = async () => {
  const res = await axios.get(
    `${API_BASE_URL}/employees/dashboard/operator/today-performance`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      withCredentials: true,
    }
  );
  return res.data;
};

// --- TOOLTIP COMPONENT (RESTORED START/END TIME) ---
const TaskTimeTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-white border rounded-lg shadow-xl p-3 text-xs space-y-1.5 border-slate-200">
      <p className="font-bold text-slate-800 border-b pb-1 mb-1">{data.fullTitle}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <p className="text-slate-500 text-[10px] uppercase font-bold">Assigned</p>
        <p className="text-slate-700 font-semibold">{data.Assigned} min</p>
        
        <p className="text-slate-500 text-[10px] uppercase font-bold">Actual</p>
        <p className="text-slate-700 font-semibold">{data.Actual} min</p>
        
        <p className="text-slate-500 text-[10px] uppercase font-bold">Started</p>
        <p className="text-blue-600 font-medium">
          {data.startTime ? new Date(data.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Not started"}
        </p>
        
        <p className="text-slate-500 text-[10px] uppercase font-bold">Ended</p>
        <p className="text-blue-600 font-medium">
          {data.endTime ? new Date(data.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "In progress"}
        </p>
      </div>
    </div>
  );
};

export default function OperatorDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  type WorkState = "WORKING" | "ON_BREAK";
  const [breakActionLoading, setBreakActionLoading] = useState(false);
  const [workState, setWorkState] = useState<WorkState>("WORKING");
  const [todayTasks, setTodayTasks] = useState<TodayTaskPerformance[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodayPerformanceSummary | null>(null);

  const { loginTime, setLoginTime } = useAuth();
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  
  const date = new Date();
  const hour = date.getHours();
  const greetings = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : hour < 21 ? "Good Evening" : "Good Night";

  // LOGIC & API SECTION (Untouched)
  useEffect(() => {
    const syncAttendanceState = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/employees/attendance/today`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.loginTime) setLoginTime(new Date(data.loginTime));
        if (data.onBreak) {
          setWorkState("ON_BREAK");
          setBreakStartTime(new Date(data.breakStartTime));
        } else {
          setWorkState("WORKING");
          setBreakStartTime(null);
        }
      } catch (err) { console.error("Attendance sync failed", err); }
    };
    syncAttendanceState();
  }, []);

  useEffect(() => {
    const loadTodayPerformance = async () => {
      try {
        const data = await getTodayPerformance();
        setTodayTasks(data.tasks);
        setTodaySummary(data.summary);
      } catch (err) { console.error("Failed to load today performance", err); }
    };
    loadTodayPerformance();
  }, []);

  const getDashboardData = async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      const response = await axios.get(`${API_BASE_URL}/tasks/Dashboard`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const { tasks, stats } = response.data;
      setTasks(tasks.filter((task: Task) => task.status !== "DONE" && task.isDeleted !== true));
      setStats(stats);
    } catch (error) { console.error("Error fetching dashboard data:", error); }
    finally { setLoading(false); }
  };

  useEffect(() => { getDashboardData(); }, []);

  const calculateProgress = (task: any) => {
    switch (task.status) {
      case "TODO": return 0;
      case "WORKING": return task.hoursUsed && task.assignedHours ? Math.min(Math.round((task.hoursUsed / task.assignedHours) * 100), 90) : 20;
      case "STUCK": return 20;
      case "DONE": return 100;
      default: return 0;
    }
  };

  const getPriorityStyles = (priority: string) => {
    if (priority === "HIGH") return "border-l-4 border-l-red-600 bg-red-50/30";
    if (priority === "MEDIUM") return "border-l-4 border-l-amber-500 bg-amber-50/30";
    return "border-l-4 border-l-blue-600 bg-blue-50/30";
  };

  const handleTakeBreak = async () => {
    if (breakActionLoading) return;
    setBreakActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/employees/attendance/break/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setBreakStartTime(new Date(data.breakStartTime));
      setWorkState("ON_BREAK");
      toast({ title: "Break started ☕", description: "Relax for a moment. Your break has begun." });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setBreakActionLoading(false); }
  };

  const handleContinueWork = async () => {
    if (breakActionLoading) return;
    setBreakActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/employees/attendance/break/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      setWorkState("WORKING");
      setBreakStartTime(null);
      toast({ title: "Welcome back! 👋", description: "Break ended. You’re back to work." });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setBreakActionLoading(false); }
  };

  const taskTimeChartData = todayTasks.map((t) => ({
    task: t.title.length > 10 ? t.title.slice(0, 10) + ".." : t.title,
    fullTitle: t.title,
    Assigned: t.assignedMinutes,
    Actual: t.actualMinutes,
    variance: t.varianceMinutes,
    startTime: t.startTime,
    endTime: t.endTime,
  }));

if (loading) {
  return (
    <Layout>
      <div className="p-4 sm:p-8 space-y-8 min-h-screen">
        {/* Header Skeleton */}
        <div className="flex justify-between items-end border-b pb-6">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-48 bg-slate-100 animate-pulse rounded" />
          </div>
          <div className="h-10 w-32 bg-slate-200 animate-pulse rounded-xl" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>

        {/* Bento Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-[400px] bg-slate-100 animate-pulse rounded-2xl" />
          <div className="lg:col-span-5 h-[400px] bg-slate-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    </Layout>
  );
}

  return (
    <Layout>
      <div className={`p-4 sm:p-8 space-y-8 min-h-screen transition-all duration-300 ${workState === "ON_BREAK" ? "pointer-events-none blur-sm" : ""}`}>
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0000cc]">My Task Performance Dashboard</h1>
            <p className="text-slate-500 mt-1">
              <span className="font-semibold text-lg">{greetings} 👋</span> <br />
              Task Management Hub • {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
             <button
              disabled={workState === "ON_BREAK" || breakActionLoading}
              onClick={handleTakeBreak}
              style={{ backgroundColor: COLOR_PRIMARY }}
              className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2 ${breakActionLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {breakActionLoading ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Take a Break"}
            </button>
            {loginTime && <p className="text-xs text-slate-400">Logged in at: <span className="font-medium">{loginTime.toLocaleTimeString()}</span></p>}
          </div>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCardWrapper>
            <StatsCard title="Total Tasks" value={stats?.totalTasks || 0} icon={FileText} color="primary" trend={`${stats?.completedTasks || 0} completed`} trendUp={true} />
          </StatsCardWrapper>
          <StatsCardWrapper>
            <StatsCard title="In Progress" value={stats?.inProgressTasks || 0} icon={Clock} color="warning" trend={`${stats?.pendingTasks || 0} pending`} />
          </StatsCardWrapper>
          <StatsCardWrapper>
            <StatsCard title="Today Assigned" value={`${Math.round((todaySummary?.totalAssignedMinutes ?? 0) / 60)}h`} icon={Target} color="primary" />
          </StatsCardWrapper>
          <StatsCardWrapper>
            <StatsCard 
                title="Efficiency" 
                value={`${todaySummary?.efficiencyPercent ?? 0}%`} 
                icon={TrendingUp} 
                color={(todaySummary?.efficiencyPercent ?? 0) >= 100 ? "destructive" : "success"}
                trend={(todaySummary?.efficiencyPercent ?? 100) >= 100 ? "Over-utilized" : "Within estimate"}
            />
          </StatsCardWrapper>
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-[#0000cc] flex items-center gap-2">
                   <Clock className="h-5 w-5 text-red-600" />
                   Today’s Task Time Usage
                </CardTitle>
                <CardDescription>Assigned vs actual working time (today only)</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[320px] w-full">
                  {todayTasks.length === 0 ? (
                    <p className="text-slate-500 text-center py-20 italic">No task activity recorded today.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskTimeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="task" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip content={<TaskTimeTooltip />} />
                        <Bar dataKey="Assigned" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30} />
                        <Bar dataKey="Actual" radius={[4, 4, 0, 0]} barSize={30}>
                          {taskTimeChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.variance > 0 ? COLOR_DANGER : COLOR_PRIMARY} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {stats?.pendingTasks! > 0 && (
              <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl">
                <div className="bg-red-600 p-2 rounded-lg"><AlertCircle className="h-5 w-5 text-white" /></div>
                <div>
                  <h4 className="font-bold text-red-900 text-sm">Pending Tasks Reminder</h4>
                  <p className="text-xs text-red-700">You have {stats?.pendingTasks} task(s) that need attention to meet deadlines.</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <Card className="border-none shadow-sm h-full flex flex-col bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-bold text-[#0000cc] flex items-center gap-2">
                  <Target className="h-5 w-5 text-red-600" />
                  My Assigned Tasks
                </CardTitle>
                <Badge variant="secondary" className="rounded-md bg-blue-100 text-[#0000cc]">{tasks.length} Active</Badge>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className={`p-4 rounded-xl border border-slate-100 transition-all hover:shadow-md bg-white ${getPriorityStyles(task.priority)}`}>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 truncate text-sm">{task.title}</h4>
                        <p className="text-[10px] text-[#0000cc] font-bold uppercase">{task.project || "General"}</p>
                      </div>
                      <Badge className={`${task.priority === 'HIGH' ? 'bg-red-600' : 'bg-[#0000cc]'} text-[9px] uppercase`}>{task.priority.toLowerCase()}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-3">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {task.hoursUsed || 0}/{task.hoursAllocated || '?'}h</span>
                      {task.dueDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-400 uppercase tracking-tighter">Progress</span>
                        <span style={{ color: COLOR_PRIMARY }}>{calculateProgress(task)}%</span>
                      </div>
                      <Progress value={calculateProgress(task)} className="h-1.5" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* --- ORIGINAL BREAK OVERLAY --- */}
      {workState === "ON_BREAK" && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div className="relative z-[100000] flex flex-col items-center text-center px-6">
            <div className="text-6xl mb-6 animate-pulse">☕</div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-2">Take a Break</h2>
            <p className="text-sm sm:text-base text-gray-200 max-w-md mb-6 leading-relaxed">
              Relax your mind. Stretch a little. The dashboard is paused until you’re ready to continue.
            </p>
            {breakStartTime && <p className="text-sm text-gray-200 mb-8">Break started at <span className="font-medium">{breakStartTime.toLocaleTimeString()}</span></p>}
            <button
              onClick={handleContinueWork}
              disabled={breakActionLoading}
              style={{ backgroundColor: COLOR_PRIMARY }}
              className="px-8 py-3 rounded-full text-sm sm:text-base font-semibold text-white flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
            >
              {breakActionLoading ? <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Continuing…</> : "Continue Working"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}