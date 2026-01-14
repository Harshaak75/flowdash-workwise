import { useState, useEffect, ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import {
  Card,
  CardDescription,
  CardTitle,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CheckCircle2,
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
  LineChart,
  Line,
} from "recharts";
import axios from "axios";

import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { toast } from "@/components/ui/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ... (Interface definitions remain the same)
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

interface Stats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  stuckTasks: number;
  completionRate: number;
  completionTrend: { week: string; rate: number }[];
}

const COLOR_PRIMARY = "#0000cc";
const COLOR_ACCENT_ICON = "text-red-500";
const COLOR_SUCCESS = "#10b981";
const COLOR_WARNING = "#f97316";

// Wrapper to force StatsCard height alignment (used below)
const StatsCardWrapper = ({ children }: { children: ReactNode }) => (
  <div className="h-full flex flex-col">{children}</div>
);

// --- SKELETON LOADER COMPONENT (No changes needed, already responsive) ---
const SkeletonOperatorDashboard = ({ PRIMARY_COLOR, ACCENT_ICON }) => {
  // Helper component for a stat card placeholder
  const StatCardSkeleton = () => (
    <Card className="p-4 border border-gray-100 shadow-sm h-full animate-pulse">
      <div className="flex items-center space-x-4">
        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gray-300 rounded-full"></div>
        <div>
          <div className="h-4 w-24 bg-gray-200 rounded mb-1"></div>
          <div className="h-5 w-14 sm:h-6 sm:w-16 bg-gray-300 rounded"></div>
        </div>
      </div>
      <div className="h-3 w-32 bg-gray-100 rounded mt-3"></div>
    </Card>
  );

  // Helper component for a task list item placeholder
  const TaskRowSkeleton = () => (
    <div className="p-4 rounded-lg border border-gray-200 bg-white animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-1">
            <div className="h-4 w-36 sm:h-5 sm:w-48 bg-gray-200 rounded"></div>
            <div className="flex gap-2">
              <div className="h-4 w-10 sm:h-5 sm:w-12 bg-gray-100 rounded-full"></div>
              <div className="h-4 w-14 sm:h-5 sm:w-16 bg-gray-100 rounded-full"></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div className="h-3 w-16 sm:h-4 sm:w-20 bg-gray-100 rounded"></div>
            <div className="h-3 w-20 sm:h-4 sm:w-24 bg-gray-100 rounded"></div>
          </div>
        </div>
        <div className="h-4 w-16 sm:h-5 sm:w-20 bg-blue-200 rounded"></div>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full bg-gray-200 rounded-full"></div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 min-h-screen">
        <div className="border-b pb-3 sm:pb-4 animate-pulse">
          <div className="h-7 w-64 sm:h-8 sm:w-80 bg-gray-300 rounded mb-1"></div>
          <div className="h-3 w-80 sm:h-4 sm:w-96 bg-gray-200 rounded"></div>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            className={`p-4 sm:p-6 border-gray-200 shadow-sm h-72 sm:h-96 animate-pulse`}
          >
            <CardHeader className="p-0 mb-4">
              <div className="h-4 w-40 sm:h-5 sm:w-48 bg-gray-300 rounded"></div>
            </CardHeader>
            <div className="h-56 sm:h-72 w-full bg-gray-100 rounded-lg"></div>
          </Card>
          <Card
            className={`p-4 sm:p-6 border-gray-200 shadow-sm h-72 sm:h-96 animate-pulse`}
          >
            <CardHeader className="p-0 mb-4">
              <div className="h-4 w-40 sm:h-5 sm:w-48 bg-gray-300 rounded"></div>
            </CardHeader>
            <div className="h-56 sm:h-72 w-full bg-gray-100 rounded-lg"></div>
          </Card>
        </div>
        <Card className={`p-4 sm:p-6 shadow-lg border-gray-200 animate-pulse`}>
          <div className="flex items-center justify-between mb-3 sm:mb-4 border-b pb-2">
            <div className="h-5 w-48 sm:h-6 sm:w-52 bg-gray-300 rounded"></div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <TaskRowSkeleton key={i} />
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
// --- END SKELETON LOADER COMPONENT ---

const calculateProgress = (task: any) => {
  switch (task.status) {
    case "TODO":
    case "PENDING":
      return 0;

    case "WORKING":
      if (task.hoursUsed && task.assignedHours) {
        return Math.min(
          Math.round((task.hoursUsed / task.assignedHours) * 100),
          90
        );
      }
      return 20;

    case "STUCK":
      return 20;

    case "DONE":
      return 100;

    default:
      return 0;
  }
};



export default function OperatorDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  type WorkState = "WORKING" | "ON_BREAK";
  const [breakActionLoading, setBreakActionLoading] = useState(false);

  const [workState, setWorkState] = useState<WorkState>("WORKING");

  const { loginTime, setLoginTime } = useAuth();
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  const date = new Date();
  const hour = date.getHours();
  let greetings;

  if (hour >= 5 && hour < 12) {
    greetings = "Good Morning";
  } else if (hour >= 12 && hour < 17) {
    greetings = "Good Afternoon";
  } else if (hour >= 17 && hour < 21) {
    greetings = "Good Evening";
  } else {
    greetings = "Good Night";
  }


  useEffect(() => {
    const syncAttendanceState = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/employees/attendance/today`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            credentials: "include",
          }
        );

        if (!res.ok) return;

        const data = await res.json();

        if (data.loginTime) {
          setLoginTime(new Date(data.loginTime));
        }

        if (data.onBreak) {
          setWorkState("ON_BREAK");
          setBreakStartTime(new Date(data.breakStartTime));
        } else {
          setWorkState("WORKING");
          setBreakStartTime(null);
        }
      } catch (err) {
        console.error("Attendance sync failed", err);
      }
    };

    syncAttendanceState();
  }, []);





  const getDashboardData = async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const response = await axios.get(`${API_BASE_URL}/tasks/Dashboard`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const { tasks, stats } = response.data;
      const activeTasks = tasks.filter(
        (task: Task) =>
          task.status !== "DONE" && task.isDeleted !== true
      );
      setTasks(activeTasks);
      setStats(stats);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getDashboardData();
  }, []);



  const getStatusBadgeStyles = (status: Task["status"]) => {
    switch (status) {
      case "WORKING":
        return "bg-blue-100 text-blue-700 border-blue-300";

      case "DONE":
        return "bg-green-100 text-green-700 border-green-300";

      case "TODO":
        return "bg-gray-100 text-gray-700 border-gray-300";

      case "STUCK":
        return "bg-red-100 text-red-700 border-red-300";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };


  const getPriorityBadgeStyles = (priority: Task["priority"]) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-600 text-white";

      case "MEDIUM":
        return "bg-amber-500 text-white";

      case "LOW":
        return "text-white"; // background via style

      default:
        return "bg-gray-500 text-white";
    }
  };


  if (loading) {
    return (
      <SkeletonOperatorDashboard
        PRIMARY_COLOR={COLOR_PRIMARY}
        ACCENT_ICON={COLOR_ACCENT_ICON}
      />
    );
  }

  const customTooltipStyle = {
    backgroundColor: "white",
    border: `1px solid ${COLOR_PRIMARY}`,
    borderRadius: "0.5rem",
    padding: "5px 10px",
  };

  const weeklyHoursLogged = tasks.reduce(
    (sum, t) => sum + (t.hoursUsed || 0),
    0
  );

  // Dynamic XAxis props for the BarChart (rotation for small screens)
  const xAxisBarChartProps =
    window.innerWidth < 640 // Tailwind's 'sm' breakpoint is 640px
      ? {
        angle: -45,
        textAnchor: "end",
        height: 70,
        style: { fontSize: "10px" },
      }
      : {
        angle: 0,
        textAnchor: "middle",
        height: 30,
        style: { fontSize: "12px" },
      };

  const handleTakeBreak = async () => {
    if (breakActionLoading) return;

    setBreakActionLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/employees/attendance/break/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start break");
      }

      setBreakStartTime(new Date(data.breakStartTime));
      setWorkState("ON_BREAK");

      toast({
        title: "Break started ☕",
        description: "Relax for a moment. Your break has begun.",
      });
    } catch (err: any) {
      toast({
        title: "Unable to start break",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setBreakActionLoading(false);
    }
  };




  const handleContinueWork = async () => {
    if (breakActionLoading) return;

    setBreakActionLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/employees/attendance/break/end`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to end break");
      }

      setWorkState("WORKING");
      setBreakStartTime(null);

      toast({
        title: "Welcome back 👋",
        description: "Break ended. You’re back to work.",
      });
    } catch (err: any) {
      toast({
        title: "Unable to continue work",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setBreakActionLoading(false);
    }
  };




  return (
    <Layout>
      <div
        className={`space-y-6 sm:space-y-8 min-h-screen transition-all duration-300 ${workState === "ON_BREAK"
          ? "pointer-events-none blur-sm"
          : ""
          }`}
      >
        {/* Header - Optimized for mobile */}
        <div className="border-b pb-3 sm:pb-4 flex justify-between">
          <div className="">
            <h1
              className="text-2xl sm:text-3xl font-bold mb-1"
              style={{ color: COLOR_PRIMARY }}
            >
              My Task Performance Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-500">
              <span className="text-[1rem] font-semibold">{greetings} 👋</span> <br />
              Task Management Hub • {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
            </p>
          </div>


          <div className="flex items-center gap-3 mt-2">
            <button
              disabled={workState === "ON_BREAK" || breakActionLoading}
              onClick={handleTakeBreak}
              style={{ backgroundColor: COLOR_PRIMARY }}
              className={`
    px-4 py-2 rounded-lg text-sm font-semibold transition
    flex items-center gap-2
    ${breakActionLoading || workState === "ON_BREAK"
                  ? "opacity-70 cursor-not-allowed"
                  : "text-white hover:opacity-90"
                }
  `}
            >
              {breakActionLoading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin " />
                  Starting…
                </>
              ) : (
                "Take a Break"
              )}
            </button>

            {loginTime && (
              <p className="text-xs text-gray-400 mt-1">
                Logged in at:{" "}
                <span className="font-medium">
                  {loginTime.toLocaleTimeString()}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid - Optimized for mobile */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCardWrapper>
            <StatsCard
              title="Total Tasks"
              value={stats?.totalTasks || 0}
              icon={FileText}
              iconClassName="h-5 w-5 sm:h-6 sm:w-6"
              valueClassName="text-2xl sm:text-3xl"
              trend={`${stats?.completedTasks || 0} completed`}
              trendUp={true}
              color="primary"
            />
          </StatsCardWrapper>
          <StatsCardWrapper>
            <StatsCard
              title="In Progress"
              value={stats?.inProgressTasks || 0}
              icon={Clock}
              iconClassName="h-5 w-5 sm:h-6 sm:w-6"
              valueClassName="text-2xl sm:text-3xl"
              trend={`${stats?.pendingTasks || 0} pending`}
              trendUp={false}
              color="warning"
            />
          </StatsCardWrapper>
          <StatsCardWrapper>
            <StatsCard
              title="Completion Rate"
              value={`${stats?.completionRate || 0}%`}
              icon={CheckCircle2}
              iconClassName="h-5 w-5 sm:h-6 sm:w-6"
              valueClassName="text-2xl sm:text-3xl"
              trend="Up 3% from last week"
              trendUp={true}
              color="success"
            />
          </StatsCardWrapper>
          <StatsCardWrapper>
            <StatsCard
              title="Total Hours Logged"
              value={`${weeklyHoursLogged}h`}
              icon={Calendar}
              iconClassName="h-5 w-5 sm:h-6 sm:w-6"
              valueClassName="text-2xl sm:text-3xl"
              trend="This Week"
              trendUp={true}
              color="primary"
            />
          </StatsCardWrapper>
        </div>

        {/* Charts - Optimized for mobile */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Weekly Hours Chart - Added dynamic XAxis props */}
          <Card
            className={`p-4 sm:p-6 border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all`}
          >
            <CardHeader className="p-0 mb-3 sm:mb-4">
              <CardTitle
                className="text-lg sm:text-xl flex items-center gap-2"
                style={{ color: COLOR_PRIMARY }}
              >
                <Clock
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${COLOR_ACCENT_ICON}`}
                />
                Weekly Hours Breakdown
              </CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={tasks.map((t, i) => ({
                  title:
                    t.title.substring(0, 15) +
                    (t.title.length > 15 ? "..." : ""),
                  hours: t.hoursUsed || 0,
                }))}
                margin={{ top: 5, right: 0, left: -20, bottom: 5 }} // Adjusted margin to fit rotated labels
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                {/* Uses dynamic props for rotation on small screens */}
                <XAxis dataKey="title" stroke="#666" {...xAxisBarChartProps} />
                <YAxis stroke="#666" domain={[0, 10]} />
                <Tooltip
                  contentStyle={customTooltipStyle}
                  formatter={(value, name, props) => [
                    `${value} hours`,
                    props.payload.title,
                  ]}
                  labelFormatter={() => "Task"}
                />
                <Bar
                  dataKey="hours"
                  fill={COLOR_PRIMARY}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Completion Trend Chart - XAxis is fine, but using dynamic sizing anyway */}
          <Card
            className={`p-4 sm:p-6 border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all`}
          >
            <CardHeader className="p-0 mb-3 sm:mb-4">
              <CardTitle
                className="text-lg sm:text-xl flex items-center gap-2"
                style={{ color: COLOR_PRIMARY }}
              >
                <TrendingUp
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${COLOR_ACCENT_ICON}`}
                />
                Task Completion Trend
              </CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats?.completionTrend || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  stroke="#666"
                  style={{ fontSize: "10px" }}
                />
                <YAxis stroke="#666" domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={customTooltipStyle}
                  formatter={(value) => [`${value}%`, "Rate"]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={COLOR_SUCCESS}
                  strokeWidth={3}
                  dot={{ fill: COLOR_SUCCESS, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Assigned Tasks List - Optimized for mobile */}
        <Card className={`p-4 sm:p-6 shadow-lg border-[#0000cc]/20`}>
          <div className="flex items-center justify-between mb-3 sm:mb-4 border-b pb-2">
            <h3
              className="text-lg sm:text-xl font-semibold flex items-center gap-2"
              style={{ color: COLOR_PRIMARY }}
            >
              <Target
                className={`h-4 w-4 sm:h-5 sm:w-5 ${COLOR_ACCENT_ICON}`}
              />
              My Assigned Tasks ({tasks.length} Active)
            </h3>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-[#0000cc]" />
                <p className="text-sm sm:text-base font-medium">
                  No tasks currently assigned to you.
                </p>
              </div>
            ) : (
              tasks.map((task) => {
                const progress = calculateProgress(task);

                return (
                  <div
                    key={task.id}
                    className="p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#0000cc]/40 transition-all bg-white hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
                      <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-bold text-sm sm:text-base text-gray-800 min-w-full sm:min-w-0">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-1 sm:gap-2 text-xs">
                            <Badge
                              variant="default"
                              className={getStatusBadgeStyles(task.status)}
                            >
                              {task.status}
                            </Badge>
                            <Badge
                              className={getPriorityBadgeStyles(task.priority)}
                              style={
                                task.priority === "LOW"
                                  ? { backgroundColor: COLOR_PRIMARY }
                                  : undefined
                              }
                            >
                              {task.priority.toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                          {task.project && (
                            <span className="font-medium text-blue-600">
                              {task.project}
                            </span>
                          )}
                          {(task.hoursUsed !== undefined ||
                            task.hoursAllocated !== undefined) && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {task.hoursUsed || 0}/{task.hoursAllocated || "?"}
                                h Used
                              </span>
                            )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* <div className="w-full sm:w-auto">
                        {task.status !== "DONE" && (
                          <button
                            className="transition-colors text-sm font-semibold sm:mt-0 mt-2 block w-full sm:w-auto text-center py-1 px-3 rounded"
                            style={{
                              color: COLOR_PRIMARY,
                              border: `1px solid ${COLOR_PRIMARY}`,
                            }}
                          >
                            Start/Update
                          </button>
                        )}
                      </div> */}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span
                          className="font-semibold"
                          style={{ color: COLOR_PRIMARY }}
                        >
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <Progress
                        value={progress}
                        className={`h-2 bg-gray-200`}
                        style={
                          {
                            "--progress-color":
                              task.status === "DONE"
                                ? COLOR_SUCCESS
                                : COLOR_PRIMARY,
                            backgroundColor: "#e2e8f0",
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Pending Tasks Reminder - Optimized for mobile */}
        {stats?.pendingTasks! > 0 && (
          <Card className={`p-3 sm:p-4 bg-amber-50 border-amber-300 shadow-sm`}>
            <div className="flex items-center gap-3">
              <AlertCircle className={`h-4 w-4 sm:h-5 sm:w-5 text-amber-600`} />
              <div className="flex-1">
                <p className={`font-medium text-amber-700 text-sm`}>
                  Pending Tasks Reminder
                </p>
                <p className="text-xs sm:text-sm text-gray-600">
                  You have <strong>{stats?.pendingTasks}</strong> task(s) that
                  need attention to meet deadlines.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {workState === "ON_BREAK" && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">

          {/* Soft dark backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

          {/* Center content (NO CARD, NO WHITE BG) */}
          <div className="relative z-[100000] flex flex-col items-center text-center px-6">

            {/* Coffee Mug Icon */}
            <div className="text-6xl mb-6 animate-pulse">
              ☕
            </div>

            {/* Main Message */}
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
              Take a Break
            </h2>

            {/* Sub Message */}
            <p className="text-sm sm:text-base text-gray-200 max-w-md mb-6 leading-relaxed">
              Relax your mind. Stretch a little.
              The dashboard is paused until you’re ready to continue.
            </p>

            {/* Break Time */}
            {breakStartTime && (
              <p className="text-sm text-gray-200 mb-8">
                Break started at{" "}
                <span className="font-medium text-gray-200">
                  {breakStartTime.toLocaleTimeString()}
                </span>
              </p>
            )}

            {/* Continue Button */}
            <button
              onClick={handleContinueWork}
              disabled={breakActionLoading}
              style={{ backgroundColor: COLOR_PRIMARY }}
              className="
    px-8 py-3 rounded-full
    text-sm sm:text-base font-semibold
    text-white
    flex items-center gap-2
    disabled:opacity-70 disabled:cursor-not-allowed
    transition-all duration-200
  "
            >
              {breakActionLoading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Continuing…
                </>
              ) : (
                "Continue Working"
              )}
            </button>

          </div>
        </div>
      )}


    </Layout>
  );
}
