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
import { Button } from "@/components/ui/button";
import {
    Clock,
    FolderKanban,
    TrendingUp,
    Target,
    AlertCircle,
    Activity,
    Coffee,
    Calendar,
    Loader2, // Added for button loading UX
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
import { useAuth } from "../AuthContext";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const PRIMARY_COLOR = "#0000cc";

/* ---------------- SKELETON LOADER (Replaces Null Return) ---------------- */
const SkeletonManagerDashboard = () => (
    <Layout>
        <div className="p-4 sm:p-10 space-y-10">
            <div className="flex justify-between items-center border-b pb-6">
                <div className="space-y-3">
                    <div className="h-10 w-72 bg-slate-200 rounded-full animate-pulse" />
                    <div className="h-4 w-48 bg-slate-100 rounded-full animate-pulse" />
                </div>
                <div className="h-12 w-40 bg-slate-200 rounded-2xl animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 h-[450px] bg-slate-100 rounded-3xl animate-pulse" />
                <div className="lg:col-span-5 h-[450px] bg-slate-100 rounded-3xl animate-pulse" />
            </div>
        </div>
    </Layout>
);

export default function ManagerDashboard() {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [now, setNow] = useState(new Date());
    const date = new Date();
    const hour = date.getHours();
    const greetings = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : hour < 21 ? "Good Evening" : "Good Night";

    const [workState, setWorkState] = useState<"WORKING" | "ON_BREAK">("WORKING");
    const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
    const [breakLoading, setBreakLoading] = useState(false);

    const { loginTime, setLoginTime } = useAuth();

    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/tasks/dashboard/manager`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            })
            .then(res => setStats(res.data.cards));
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const syncAttendance = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/employees/attendance/today`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.loginTime) setLoginTime(new Date(data.loginTime));
                if (data.onBreak) {
                    setWorkState("ON_BREAK");
                    setBreakStartTime(new Date(data.breakStartTime));
                }
            } catch (e) { console.error(e); }
        };
        syncAttendance();
    }, []);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [dashRes, taskRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/employees/dashboard`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                    }),
                    fetch(`${API_BASE_URL}/employees/dashboard/manager/today-performance`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                    }),
                ]);
                const dash = await dashRes.json();
                const perf = await taskRes.json();
                setDashboardData(dash);
                setTasks(perf.tasks || []);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const handleBreak = async (start: boolean) => {
        setBreakLoading(true);
        const endpoint = start ? "start" : "end";
        try {
            const res = await fetch(`${API_BASE_URL}/employees/attendance/break/${endpoint}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            const data = await res.json();

            if (start) {
                setBreakStartTime(new Date(data.breakStartTime));
                setWorkState("ON_BREAK");
            } else {
                setWorkState("WORKING");
                setBreakStartTime(null);
            }
        } catch (e) { console.error(e); }
        finally { setBreakLoading(false); }
    };

    // Return Skeleton while loading to prevent "Vanishing Sidebar" bug
    if (loading) return <SkeletonManagerDashboard />;

    /* ---------------- BAR DATA ---------------- */
    const taskChartData = tasks.map((t) => {
        let actual = t.actualMinutes || 0;
        if (t.startTime && !t.endTime) {
            actual += Math.floor((now.getTime() - new Date(t.startTime).getTime()) / 60000);
        }
        return {
            name: t.title.length > 8 ? t.title.slice(0, 8) + ".." : t.title,
            Assigned: t.assignedMinutes,
            Actual: actual,
            variance: actual - t.assignedMinutes,
        };
    });

    const totalAssigned = taskChartData.reduce((s, t) => s + t.Assigned, 0);
    const totalActual = taskChartData.reduce((s, t) => s + t.Actual, 0);
    const efficiency = totalAssigned > 0 ? Math.round((totalActual / totalAssigned) * 100) : 100;

    const calculateProgress = (task: any) => {
        switch (task.status) {
            case "TODO": return 0;
            case "WORKING":
            case "IN_PROGRESS": {
                if (task.hoursUsed && task.assignedHours && task.assignedHours > 0) {
                    const calculated = Math.round((task.hoursUsed / task.assignedHours) * 100);
                    // Ensure at least 30% progress when started, cap at 90% until done
                    return Math.max(30, Math.min(calculated, 90));
                }
                return 30; // Default to 30% if hours data is missing but task is started
            }
            case "STUCK": return 30;
            case "DONE": return 100;
            default: return 0;
        }
    };

    const getPriorityColor = (priority: string) => {
        if (priority === "HIGH") return "bg-red-600";
        if (priority === "MEDIUM") return "bg-blue-700";
        return "bg-green-600";
    };

    return (
        <Layout
            headerActions={
                <div className="flex items-center gap-4">
                    {/* ⏰ Clean Login Time */}
                    {loginTime && (
                        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">{loginTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}

                    {/* ☕ Simple Take a Break Button */}
                    <button
                        onClick={() => handleBreak(true)}
                        disabled={breakLoading}
                        className="px-5 py-2 bg-[#0000cc] hover:bg-[#0000dd] text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {breakLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Loading...</span>
                            </div>
                        ) : (
                            "Take a Break"
                        )}
                    </button>
                </div>
            }
        >
            <div className={`space-y-8 min-h-screen transition-all duration-300 ${workState === "ON_BREAK" ? "blur-sm pointer-events-none scale-[0.99]" : ""}`}>

                {/* SIMPLIFIED HEADER */}
                <header className="border-b border-slate-100 pb-6 mb-8">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold tracking-tight text-[#0000cc]">My Task Performance Dashboard</h1>
                        <p className="text-slate-500">
                            <span className="font-semibold text-lg">{greetings} 👋</span> <br />
                            Task Management Hub • {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
                        </p>
                    </div>
                </header>

                {/* 📱 MOBILE ACTIONS */}
                <div className="lg:hidden flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 mb-6">
                    {loginTime && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">{loginTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}
                    <button
                        onClick={() => handleBreak(true)}
                        disabled={breakLoading}
                        className="px-4 py-2 bg-[#0000cc] hover:bg-[#0000dd] text-white text-sm font-semibold rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                        {breakLoading ? "Loading..." : "Take a Break"}
                    </button>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard title="Total Tasks" value={stats?.totalTasks} icon={FolderKanban} color="primary" trend="15 completed" trendUp={true} />
                    <StatsCard title="In Progress" value={stats?.inProgressTasks} icon={Clock} color="warning" trend="8 pending" />
                    <StatsCard title="Today Assigned" value={stats?.todayAssignedHours} icon={Target} color="primary" />
                    <StatsCard title="Efficiency" value={stats?.completionRate + "%"} icon={TrendingUp} color="success" trend="Within estimate" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT: CHART */}
                    <div className="lg:col-span-7">
                        <Card className="border-none shadow-sm bg-white overflow-hidden rounded-3xl">
                            <CardHeader className="bg-slate-50/30 border-b border-slate-100 pb-4 p-6">
                                <CardTitle className="text-lg font-bold text-[#0000cc] flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-red-500" /> Today's Task Time Usage
                                </CardTitle>
                                <CardDescription>Assigned vs actual working time (today only)</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-8 p-6 flex flex-col items-center justify-center min-h-[350px]">
                                {taskChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={taskChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${value}m`} />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                formatter={(value: any, name: any) => [`${value} minutes`, name]}
                                                contentStyle={{
                                                    borderRadius: '12px',
                                                    border: 'none',
                                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                                }}
                                            />
                                            <Bar
                                                dataKey="Assigned"
                                                name="Assigned"
                                                fill="#94a3b8"
                                                radius={[4, 4, 0, 0]}
                                                barSize={35}
                                            />
                                            <Bar
                                                dataKey="Actual"
                                                name="Actual"
                                                radius={[4, 4, 0, 0]}
                                                barSize={35}
                                            >
                                                {taskChartData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.variance > 0 ? "#ef4444" : "#0000cc"} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    /* INFORMATIVE EMPTY STATE MESSAGE */
                                    <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-700">
                                        <div className="p-4 bg-slate-50 rounded-full">
                                            <Target className="h-12 w-12 text-slate-300" />
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-lg font-bold text-slate-700">No Assigned Tasks Today</h3>
                                            <p className="text-sm text-slate-400 max-w-[250px]">
                                                Your schedule is clear for today. New tasks will appear here once they are assigned.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* <div className="mt-6 flex items-center gap-4 p-5 bg-red-50 border border-red-100 rounded-3xl">
                            <div className="bg-red-500 p-2.5 rounded-2xl shadow-lg shadow-red-200">
                                <AlertCircle className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-red-900 text-sm">Pending Tasks Reminder</h4>
                                <p className="text-xs text-red-700">You have 8 task(s) that need attention to meet deadlines.</p>
                            </div>
                        </div> */}
                    </div>

                    {/* RIGHT: TASK LIST */}
                    <div className="lg:col-span-5">
                        <Card className="border-none shadow-sm h-full flex flex-col bg-white rounded-3xl overflow-hidden">
                            <CardHeader className="bg-slate-50/30 border-b border-slate-100 flex-row items-center justify-between space-y-0 p-6">
                                <CardTitle className="text-lg font-bold text-[#0000cc] flex items-center gap-2">
                                    <Target className="h-5 w-5 text-red-500" /> My Assigned Tasks
                                </CardTitle>
                                {/* <Badge className="bg-blue-100 text-[#0000cc] border-none font-bold">8 Active</Badge> */}
                            </CardHeader>
                            <CardContent className="p-6 space-y-4 overflow-y-auto max-h-[600px] flex-1">
                                {tasks.length > 0 ? (
                                    /* SHOW TASK LIST IF TASKS EXIST */
                                    tasks.map((task) => {
                                        const progress = calculateProgress(task);
                                        return (
                                            <div key={task.id} className="p-5 rounded-[1rem] border border-slate-100 bg-white shadow-sm border-l-4 border-l-amber-500 relative transition-all hover:shadow-md hover:scale-[1.01]">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="space-y-0.5">
                                                        <h4 className="font-bold text-slate-900 text-[1rem]">{task.title}</h4>
                                                        <p className="text-[10px] text-[#0000cc] font-black uppercase tracking-widest">GENERAL</p>
                                                    </div>
                                                    <Badge className={`${getPriorityColor(task.priority || "MEDIUM")} text-[9px] px-2 py-0.5 rounded-md uppercase font-black text-white`}>{task.priority || "MEDIUM"}</Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mb-3 mt-2">
                                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {task.hoursUsed || 0}/{task.assignedHours || '?'}h</span>
                                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No Date"}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                                                        <span>Progress</span>
                                                        <span className="text-[#0000cc]">{progress}%</span>
                                                    </div>
                                                    <Progress value={progress} className="h-1.5 bg-slate-100" />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    /* SHOW EMPTY STATE MESSAGE IF NO TASKS */
                                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-4 animate-in fade-in duration-500">
                                        <div className="p-4 bg-blue-50 rounded-2xl">
                                            <FolderKanban className="h-10 w-10 text-blue-200" />
                                        </div>
                                        <div className="text-center px-6">
                                            <h3 className="font-bold text-slate-700 text-lg">No Active Tasks</h3>
                                            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                                                There are no tasks assigned to you at the moment. Enjoy your downtime or check back later.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* BREAK OVERLAY */}
            {workState === "ON_BREAK" && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
                    <div className="relative z-10 text-center max-w-sm px-6">
                        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce">
                            <Coffee className="h-10 w-10 text-[#0000cc]" />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Currently on Break</h2>
                        <p className="text-white/80 mb-8 text-sm leading-relaxed">Relax your mind. Your break started at <span className="font-bold">{breakStartTime?.toLocaleTimeString()}</span>. The dashboard is paused.</p>
                        <Button
                            onClick={() => handleBreak(false)}
                            disabled={breakLoading}
                            className="bg-[#0000cc] hover:bg-[#0000cc]/90 text-white rounded-2xl h-14 px-10 font-black shadow-2xl w-full flex items-center justify-center"
                        >
                            {breakLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                "Continue Working"
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </Layout>
    );
}