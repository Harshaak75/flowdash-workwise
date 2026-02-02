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
  TrendingUp,
  AlertCircle,
  Zap,
  Plus, // Keep Plus for the Create Employee button, even if dialog trigger is hidden
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
import axios from "axios";

// --- NEW SKELETON LOADER COMPONENT ---
const SkeletonManagerDashboard = ({ PRIMARY_COLOR }) => {
  // Helper component for a stat card placeholder
  const StatCardSkeleton = () => (
    <Card className="p-4 border border-gray-100 shadow-sm h-28 animate-pulse">
      <div className="flex items-center space-x-4">
        <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="grid gap-6 md:grid-cols-2">
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
  const [role, setRole] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const PRIMARY_COLOR = "#0000cc"; // Define color for skeleton usage

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchDashboard() {
      // Simulate a slightly longer load time to showcase the skeleton screen
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const res = await fetch(`${API_BASE_URL}/employees/dashboard`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        const data = await res.json();

        // Add dummy data structure if data is missing, just for rendering demo
        if (!data || !data.weeklyData || !data.performanceData) {
          setDashboardData({
            totalEmployees: 45,
            activeEmployees: 40,
            totalTasks: 120,
            completionRate: 85,
            weeklyData: [
              { day: "Mon", hours: 8 },
              { day: "Tue", hours: 9 },
              { day: "Wed", hours: 7 },
              { day: "Thu", hours: 8 },
              { day: "Fri", hours: 10 },
            ],
            performanceData: [
              { week: "W1", completion: 70 },
              { week: "W2", completion: 75 },
              { week: "W3", completion: 85 },
              { week: "W4", completion: 90 },
            ],
            teamOverview: [
              {
                id: 1,
                name: "Alex Johnson",
                status: "Active",
                role: "Developer",
                tasksCompleted: 20,
                hoursLogged: 45,
                efficiency: 88,
              },
              {
                id: 2,
                name: "Maya Lee",
                status: "Active",
                role: "Designer",
                tasksCompleted: 15,
                hoursLogged: 40,
                efficiency: 92,
              },
              {
                id: 3,
                name: "Ben Wong",
                status: "On Leave",
                role: "Analyst",
                tasksCompleted: 5,
                hoursLogged: 10,
                efficiency: 50,
              },
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
  if (!dashboardData)
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-80px)] p-6">
          <Card className="w-full max-w-lg p-6 text-center border-red-500 bg-red-50 shadow-xl">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
            <CardTitle
              className="text-2xl font-bold mb-2"
              style={{ color: PRIMARY_COLOR }}
            >
              Data Loading Failed
            </CardTitle>
            <CardDescription className="text-red-800 mb-4">
              {
                "We're having trouble loading the dashboard data right now. Please try refreshing the page."
              }
            </CardDescription>{" "}

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
    );

  const {
    totalEmployees,
    activeEmployees,
    totalTasks,
    completionRate,
    weeklyData,
    performanceData,
    teamOverview,
    totalWeeklyHours,
  } = dashboardData;

  return (
    <Layout>
      <div className="space-y-8 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-[#0000cc]">
              Project Manager Dashboard
            </h1>
            <p className="text-gray-500">
              Manage team, track performance, and assign tasks
            </p>
          </div>
          <Dialog open={isCreateEmpOpen} onOpenChange={setIsCreateEmpOpen}>
            <DialogTrigger asChild></DialogTrigger>
            <DialogContent className="bg-white rounded-xl shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-[#0000cc]">
                  Create New Employee
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Employee Name</Label>
                  <Input placeholder="Enter full name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="employee@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="designer">Designer</SelectItem>
                      <SelectItem value="tester">QA Tester</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-[#0000cc] hover:bg-[#0000cc]/90 text-white">
                  Create Employee
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
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
            value={totalWeeklyHours}
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
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="px-3 py-4 sm:p-6 border border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-[#0000cc]">
                Weekly Hours Overview
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={weeklyData}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#666" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#666"
                  tick={{ fontSize: 10 }}
                  domain={[0, Math.max(...weeklyData.map((d) => d.hours)) + 5]}
                />
                <Tooltip />
                <Bar
                  dataKey="hours"
                  fill="#0000cc"
                  barSize={32}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="px-3 py-4 sm:p-6 border border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-[#0000cc]">
                Task Completion Trend
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={performanceData}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#666" tick={{ fontSize: 10 }} />
                <YAxis stroke="#666" tick={{ fontSize: 10 }} />
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
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            Search employees...
            <h3 className="text-lg font-semibold text-[#0000cc]">
              Team Overview
            </h3>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* <Input
                placeholder="Search employees..."
                className="w-full sm:w-64 border-gray-300"
              /> */}
              <Select>
                <SelectTrigger className="w-full sm:w-32">
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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-[#0000cc] flex items-center justify-center text-white font-semibold">
                      {(emp.name ?? "")
                        .split(" ")
                        .filter(Boolean)
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-800">
                          {emp.name}
                        </h4>
                        <Badge
                          variant={
                            emp.status === "Active" ? "success" : "default"
                          }
                          className={
                            emp.status === "Active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }
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
                      <p className="text-lg font-semibold text-[#0000cc]">
                        {emp.tasksCompleted}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Hours</p>
                      <p className="text-lg font-semibold text-[#0000cc]">
                        {emp.hoursLogged}h
                      </p>
                    </div>
                    <div className="text-center min-w-[80px]">
                      <p className="text-sm text-gray-500 mb-1">Efficiency</p>
                      <Progress
                        value={emp.efficiency}
                        className="h-2 bg-blue-100"
                      />
                      <p className="text-xs font-medium mt-1 text-[#0000cc]">
                        {emp.efficiency}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
