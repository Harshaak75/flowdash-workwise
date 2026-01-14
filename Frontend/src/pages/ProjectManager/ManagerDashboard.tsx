import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    FolderKanban,
    Users,
    Clock,
    CheckCircle2,
    Plus,
    TrendingUp,
    Calendar,
    FileText,
    AlertCircle,
    Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "../AuthContext";
// import { ThreeDot} from 'react-loading-indicators'; // Removed ThreeDot

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- SKELETON LOADER COMPONENT ---
const SkeletonManagerDashboard = ({ PRIMARY_COLOR }) => {
    // Helper component for a stat card placeholder
    const StatCardSkeleton = () => (
        <Card className="p-4 border border-gray-100 shadow-sm h-28 animate-pulse">
            <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-300 rounded-full"></div>
                <div>
                    <div className="h-4 w-24 bg-gray-200 rounded mb-1"></div>
                    <div className="h-6 w-16 bg-gray-300 rounded"></div>
                </div>
            </div>
            <div className="h-3 w-32 bg-gray-100 rounded mt-3"></div>
        </Card>
    );

    // Helper component for a team row placeholder
    const TeamRowSkeleton = () => (
        <div className="p-4 rounded-lg border border-gray-100 bg-white animate-pulse">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-gray-300"></div>
                    <div className="flex-1 space-y-1">
                        <div className="h-5 w-48 bg-gray-200 rounded"></div>
                        <div className="h-3 w-24 bg-gray-100 rounded"></div>
                    </div>
                </div>
                <div className="flex items-center gap-8">
                    <div className="h-10 w-10 bg-gray-200 rounded"></div>
                    <div className="h-10 w-10 bg-gray-200 rounded"></div>
                    <div className="h-10 w-20 bg-gray-200 rounded"></div>
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="space-y-8 min-h-screen">
                {/* Skeleton Header */}
                <div className="flex items-center justify-between border-b pb-4 animate-pulse">
                    <div>
                        <div className="h-8 w-80 bg-gray-300 rounded"></div>
                        <div className="h-4 w-96 bg-gray-200 rounded mt-2"></div>
                    </div>
                    <div className="h-10 w-40 bg-blue-200 rounded-lg"></div>
                </div>

                {/* Skeleton Stats Grid */}
                <div className="grid gap-4 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <StatCardSkeleton key={i} />
                    ))}
                </div>

                {/* Skeleton Charts */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="p-6 border border-gray-200/50 shadow-sm h-[320px] animate-pulse">
                        <div className="h-5 w-48 bg-gray-200 rounded mb-4"></div>
                        <div className="h-[250px] w-full bg-gray-100 rounded-lg"></div>
                    </Card>
                    <Card className="p-6 border border-gray-200/50 shadow-sm h-[320px] animate-pulse">
                        <div className="h-5 w-48 bg-gray-200 rounded mb-4"></div>
                        <div className="h-[250px] w-full bg-gray-100 rounded-lg"></div>
                    </Card>
                </div>

                {/* Skeleton Team Overview */}
                <Card className="p-6 border border-gray-200/50 shadow-md animate-pulse">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-5 w-40 bg-gray-300 rounded"></div>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-64 bg-gray-200 rounded"></div>
                            <div className="h-8 w-32 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <TeamRowSkeleton key={i} />
                        ))}
                    </div>
                </Card>
            </div>
        </Layout>
    );
};
// --- END SKELETON LOADER COMPONENT ---





export default function ManagerDashboard() {
    const [isCreateEmpOpen, setIsCreateEmpOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<any>(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const PRIMARY_COLOR = "#0000cc";

    type WorkState = "WORKING" | "ON_BREAK";

    const [workState, setWorkState] = useState<WorkState>("WORKING");
    const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
    const [breakLoading, setBreakLoading] = useState(false);
    

    const { loginTime, setLoginTime } = useAuth();
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

    const handleTakeBreak = async () => {
        try {
            setBreakLoading(true);

            const res = await fetch(
                `${API_BASE_URL}/employees/attendance/break/start`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    credentials: "include",
                }
            );

            if (!res.ok) throw new Error("Failed to start break");

            const data = await res.json();

            setBreakStartTime(new Date(data.breakStartTime));
            setWorkState("ON_BREAK");
        } catch (err) {
            alert("Unable to start break. Try again.");
        } finally {
            setBreakLoading(false);
        }
    };

    const handleContinueWork = async () => {
        try {
            setBreakLoading(true);

            const res = await fetch(
                `${API_BASE_URL}/employees/attendance/break/end`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    credentials: "include",
                }
            );

            if (!res.ok) throw new Error("Failed to end break");

            setWorkState("WORKING");
            setBreakStartTime(null);
        } catch (err) {
            alert("Unable to continue work.");
        } finally {
            setBreakLoading(false);
        }
    };

    useEffect(() => {
        async function fetchDashboard() {
            // Simulate a slight delay to allow the skeleton screen to be visible
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const res = await fetch(`${API_BASE_URL}/employees/dashboard`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`, // adjust if using cookies
                    },
                });
                if (!res.ok) throw new Error("Failed to fetch dashboard data");
                const data = await res.json();

                // *** Using dummy data structure if the fetch is unsuccessful for component display, 
                //     you should remove this once your API is fully stable. ***
                if (!data || !data.weeklyData || !data.performanceData) {
                    setDashboardData({
                        totalEmployees: 45,
                        activeEmployees: 40,
                        totalTasks: 120,
                        completionRate: 85,
                        weeklyData: [{ day: 'Mon', hours: 8 }, { day: 'Tue', hours: 9 }, { day: 'Wed', hours: 7 }, { day: 'Thu', hours: 8 }, { day: 'Fri', hours: 10 }],
                        performanceData: [{ week: 'W1', completion: 70 }, { week: 'W2', completion: 75 }, { week: 'W3', completion: 85 }, { week: 'W4', completion: 90 }],
                        teamOverview: [
                            { id: 1, name: 'Alex Johnson', status: 'Active', role: 'Developer', tasksCompleted: 20, hoursLogged: 45, efficiency: 88 },
                            { id: 2, name: 'Maya Lee', status: 'Active', role: 'Designer', tasksCompleted: 15, hoursLogged: 40, efficiency: 92 },
                            { id: 3, name: 'Ben Wong', status: 'On Leave', role: 'Analyst', tasksCompleted: 5, hoursLogged: 10, efficiency: 50 },
                        ],
                    });
                } else {
                    setDashboardData(data);
                }

                setLoading(false);
            } catch (error) {
                console.error(error);
                setLoading(false);
            }
        }
        fetchDashboard();
    }, []);

    if (loading) {
        return <SkeletonManagerDashboard PRIMARY_COLOR={PRIMARY_COLOR} />;
    }

    // Error state (remains the same)
    if (!dashboardData) return <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-80px)] p-6">
            <Card className="w-full max-w-lg p-6 text-center border-red-500 bg-red-50 shadow-xl">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
                <CardTitle className="text-2xl font-bold mb-2" style={{ color: PRIMARY_COLOR }}>
                    Data Loading Failed
                </CardTitle>
                <CardDescription className="text-red-800 mb-4">
                    {"We're having trouble loading the dashboard data right now. Please try refreshing the page."}
                </CardDescription>
                <Button
                    onClick={() => window.location.reload()}
                    className="gap-2 bg-[#0000cc] hover:bg-[#0000cc]/90 text-white rounded-lg shadow-md"
                >
                    <Zap className="h-4 w-4 text-red-500" />
                    Try Refreshing
                </Button>
            </Card>
        </div>
    </Layout>

    const {
        totalEmployees,
        activeEmployees,
        totalTasks,
        completionRate,
        weeklyData,
        performanceData,
        teamOverview,
    } = dashboardData;

    return (
        <Layout>
            <div
                className={`space-y-8 transition-all duration-300 ${workState === "ON_BREAK" ? "pointer-events-none blur-sm" : ""
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[#0000cc]">
                            Manager Dashboard
                        </h1>
                        <p className="text-gray-500">
                            Manage team, track performance, and assign tasks
                        </p>

                        {loginTime && (
                            <p className="text-sm text-gray-400 mt-2">
                                Logged in at{" "}
                                <span className="font-medium">
                                    {loginTime.toLocaleTimeString()}
                                </span>
                            </p>
                        )}
                    </div>

                    <button
                        disabled={workState === "ON_BREAK" || breakLoading}
                        onClick={handleTakeBreak}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition
      ${workState === "ON_BREAK"
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-[#0000cc] text-white hover:bg-[#0000cc]/90"
                            }
    `}
                    >
                        {breakLoading ? "Processing..." : "Take a Break"}
                    </button>
                </div>

            </div>

            {/* Stats Grid */}
            <div className="grid pt-4 pb-4 gap-4 md:grid-cols-4">
                <StatsCard
                    title="Total Employees"
                    value={totalEmployees}
                    icon={Users}
                    trend={`${activeEmployees} active`}
                    trendUp={true}
                    color="primary"
                />
                <StatsCard
                    title="Total Tasks"
                    value={totalTasks}
                    icon={FolderKanban}
                    trend={`${completionRate}% completed`}
                    trendUp={true}
                    color="success"
                />
                <StatsCard
                    title="Total Hours (Week)"
                    value={weeklyData.reduce((sum: number, d: any) => sum + d.hours, 0)}
                    icon={Clock}
                    trend="Weekly logged hours"
                    trendUp={true}
                    color="warning"
                />
                <StatsCard
                    title="Completion Rate"
                    value={`${completionRate}%`}
                    icon={CheckCircle2}
                    trend="+ vs last week"
                    trendUp={true}
                    color="success"
                />
            </div>

            {/* Charts */}
            <div className="grid gap-6 pt-4 pb-4 lg:grid-cols-2">
                <Card className="p-6 border border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-red-500" />
                        <h3 className="text-lg font-semibold text-[#0000cc]">Weekly Hours Overview</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="day" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip />
                            <Bar dataKey="hours" fill="#0000cc" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                <Card className="p-6 border border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 className="h-5 w-5 text-red-500" />
                        <h3 className="text-lg font-semibold text-[#0000cc]">Task Completion Trend</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={performanceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="week" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip />
                            <Line
                                type="monotone"
                                dataKey="completion"
                                stroke="#0000cc"
                                strokeWidth={3}
                                dot={{ fill: "#D70707", r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Team Overview */}
            <Card className="p-6 border border-[#0000cc]/20 shadow-md">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#0000cc]">Team Overview</h3>
                    <div className="flex items-center gap-2">
                        <Input placeholder="Search employees..." className="w-64 border-gray-300" />
                        <Select>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="leave">On Leave</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-4">
                    {teamOverview.map((emp: any) => (
                        <div
                            key={emp.id}
                            className="p-4 rounded-lg border border-gray-200 hover:border-[#0000cc]/40 transition-all bg-white hover:shadow-md"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="h-12 w-12 rounded-full bg-[#0000cc] flex items-center justify-center text-white font-semibold">
                                        {emp.name.split(" ").map((n: string) => n[0]).join("")}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-800">{emp.name}</h4>
                                            <Badge
                                                variant={emp.status === "Active" ? "success" : "default"}
                                                className={emp.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}
                                            >
                                                {emp.status}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-500">{emp.role}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-center">
                                        <p className="text-sm text-gray-500">Tasks</p>
                                        <p className="text-lg font-semibold text-[#0000cc]">{emp.tasksCompleted}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-gray-500">Hours</p>
                                        <p className="text-lg font-semibold text-[#0000cc]">{emp.hoursLogged}h</p>
                                    </div>
                                    <div className="text-center min-w-[80px]">
                                        <p className="text-sm text-gray-500 mb-1">Efficiency</p>
                                        <Progress value={emp.efficiency} className="h-2 bg-blue-100" />
                                        <p className="text-xs font-medium mt-1 text-[#0000cc]">{emp.efficiency}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}


                </div>




            </Card>

            {workState === "ON_BREAK" && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

                    {/* Content */}
                    <div className="relative z-[100000] flex flex-col items-center text-center px-6">
                        <div className="text-6xl mb-6 animate-pulse">☕</div>

                        <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
                            Take a Break
                        </h2>

                        <p className="text-sm sm:text-base text-gray-200 max-w-md mb-6">
                            You’re currently on a break.
                            The dashboard is paused until you continue.
                        </p>

                        {breakStartTime && (
                            <p className="text-sm text-gray-200 mb-8">
                                Break started at{" "}
                                <span className="font-medium">
                                    {breakStartTime.toLocaleTimeString()}
                                </span>
                            </p>
                        )}

                        <button
                            onClick={handleContinueWork}
                            disabled={breakLoading}
                            className="
          px-8 py-3 rounded-full
          text-white font-semibold
          bg-[#0000cc]
          transition-all
        "
                        >
                            {breakLoading ? "Resuming..." : "Continue Working"}
                        </button>
                    </div>
                </div>
            )}

        </Layout>
    );
}