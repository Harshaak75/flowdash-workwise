import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/ProjectManager/ManagerDashboard";
import OperatorDashboard from "./pages/OperatorDashboard";
import NotFound from "./pages/NotFound";
import { EmployeeManagerDashboard } from "./pages/ProjectManager/Employees";
import EmployeePerformanceDashboard from "./pages/ProjectManager/performance";
import TeamReportsDashboard from "./pages/ProjectManager/Report";
import EmployeeTaskTimeline from "./pages/Timeline";
import HrmDashboard from "./pages/hrmDashboard";
import HrmManagerDashboard from "./pages/ProjectManager/hrmDashboardManager";
import MainDashboard from "./pages/MainManager/mainDashboard";
import { AuthProvider } from "./pages/AuthContext";
import AssignmentDashboard from "./pages/MainManager/EmployeeAssignment";
import KanbanBoard from "./pages/ProjectManager/KanbanBoard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/project_manager" element={<MainDashboard />} />
            <Route path="/tasks" element={<EmployeeManagerDashboard />} />
            <Route
              path="/performance"
              element={<EmployeePerformanceDashboard />}
            />
            <Route path="/manager/reports" element={<TeamReportsDashboard />} />
            <Route path="/manager/hrm" element={<HrmManagerDashboard />} />
            <Route path="/operator" element={<OperatorDashboard />} />
            <Route path="/project_manager/employee-assignment" element={<AssignmentDashboard />} />
            <Route path="/timesheet" element={<EmployeeTaskTimeline />} />
            <Route path="/kanbanBoard" element={<KanbanBoard />} />
            <Route path="/operator/hrm" element={<HrmDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
