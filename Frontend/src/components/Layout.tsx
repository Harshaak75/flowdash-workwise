import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  LogOut,
  Clock,
  PersonStanding,
  Menu,
  X,
  KanbanIcon,
} from "lucide-react";

import { useAuth } from "@/pages/AuthContext";
import { NotificationBell } from "./NotificationBell";

interface LayoutProps {
  children: ReactNode;
  headerActions?: ReactNode; // 🟢 New Prop for injecting content into Navbar
}

// --- LOGO VARIABLES ---
const DESKTOP_LOGO_URL = "https://i0.wp.com/dotspeaks.com/wp-content/uploads/2025/07/Dotspeaks-logo_bg.png?fit=2560%2C591&ssl=1";
// Placeholder for mobile logo based on your image
const MOBILE_LOGO_PLACEHOLDER = "D";
// ----------------------

const LOGOUT_MESSAGES = [
  "Wrapping up your work for today…",
  "Logging you out securely 🔐",
  "Thanks for your contribution today 🌟",
  "Every effort counts. See you soon!",
  "Take a well-deserved break ☕",
];

export const Layout = ({ children, headerActions }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessageIndex, setLogoutMessageIndex] = useState(0);

  useEffect(() => {
    if (!isLoggingOut) return;
    const interval = setInterval(() => {
      setLogoutMessageIndex((i) => (i + 1) % LOGOUT_MESSAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoggingOut]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <div className="p-6">Unauthorized</div>;

  const role = user.role.toLowerCase();
  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout`, {
        headers: {
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        method: "POST",
        credentials: "include",
      });
      localStorage.removeItem("token");
      localStorage.removeItem("userEmail")
      localStorage.removeItem("userRole");
    } catch (err) {
      console.error("Logout failed:", err);
      // Even if backend fails, we still log out locally
    } finally {
      // Small delay for UX smoothness
      setTimeout(() => {
        setUser(null);
        navigate("/login");
        setIsLoggingOut(false);
      }, 1200);
    }
  };

  const getNavItems = () => {
    const common = [
      { icon: LayoutDashboard, label: "Dashboard", path: `/${role}` },
    ];

    if (role === "manager") {
      return [
        ...common,
        { icon: KanbanIcon, label: "Kanban Board", path: "/kanbanBoard" },
        { icon: Users, label: "Employees", path: "/tasks" },
        { icon: Clock, label: "My Task", path: "/timesheet" },
        { icon: BarChart3, label: "Performance", path: "/performance" },
        { icon: FileText, label: "Reports", path: "/manager/reports" },
        { icon: PersonStanding, label: "My HRM", path: "/manager/hrm" },
      ];
    }

    if (role === "project_manager") {
      return [
        ...common,
        { icon: KanbanIcon, label: "Kanban Board", path: "/kanbanBoard" },
        { icon: Users, label: "Managers", path: "/tasks" },
        { icon: BarChart3, label: "Performance", path: "/performance" },
        { icon: PersonStanding, label: "Employee Assign", path: "/project_manager/employee-assignment" },
        { icon: FileText, label: "Reports", path: "/manager/reports" },
      ];
    }

    if (role === "operator") {
      return [
        ...common,
        { icon: Clock, label: "My Task", path: "/timesheet" },
        { icon: PersonStanding, label: "My HRM", path: "/operator/hrm" },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  return (
    // Set min-h-screen on the overall container
    <div className="min-h-screen bg-background">

      {/* 🔴 MOBILE HEADER (Hamburger left, Logo right) 🔴 */}
      <header className="lg:hidden sticky top-0 z-50 bg-white shadow-md p-4 flex items-center justify-between">
        {/* Hamburger Icon (Left) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-[#2a00b7] hover:bg-gray-100 order-1"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>

        {/* Mobile Logo + Bell (Right) */}
        <div className="flex items-center gap-4 order-2">
          <NotificationBell />
          <div className="h-8 w-8 bg-red-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
            {MOBILE_LOGO_PLACEHOLDER}
          </div>
        </div>
      </header>

      {/* 🔵 SIDEBAR - **Fixed on all screen sizes** except for the translate property 🔵 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#2a00b7] text-white flex flex-col shadow-lg 
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:w-60 lg:h-screen`} // Removed lg:static
      >
        {/* Desktop Logo */}
        <div className="flex items-center justify-center h-20 border-b border-white/20">
          <img
            src={DESKTOP_LOGO_URL}
            alt="Logo"
            className="w-40"
          />
        </div>

        {/* Navigation - Uses flex-1 and overflow-y-auto to allow scrolling *inside* the sidebar if needed */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium cursor-pointer transition-all duration-200 ${isActive
                    ? "bg-white text-[#2a00b7]"
                    : "text-white hover:bg-white/10"
                    }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-colors duration-200 ${isActive ? "text-red-500" : "text-white"
                      }`}
                  />
                  <span
                    className={`transition-colors duration-200 ${isActive ? "text-[#2a00b7]" : "text-white"
                      }`}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/20 p-4">
          <div className="bg-white/10 rounded-lg p-3 text-sm mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-white/80" />
              <span className="capitalize">{role == "operator" ? "Employee" : role}</span>
            </div>
            <p className="text-xs text-white/70 truncate">
              {user.email}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-white hover:bg-red-600/80 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}


      {/* 🟢 MAIN CONTENT */}
      {/* Scrollable content area starts here */}
      <main className="lg:ml-60 flex-1 overflow-y-auto min-h-screen flex flex-col bg-gray-50/10">

        {/* DESKTOP HEADER */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur border-b sticky top-0 z-20 shadow-sm h-16">

          {/* 🟢 Left Side: Injected Actions (Take Break, Login Time) */}
          <div className="flex-1 flex items-center gap-4">
            {headerActions}
          </div>

          {/* Right Side: Notification & Profile */}
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="h-8 w-px bg-gray-200 mx-1" />
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-gray-900 capitalize">{role == "operator" ? "Employee" : role}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-md">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        <div
          className={
            location.pathname.includes("/hrm")
              ? "pt-6 pl-2 pr-6" // Reduced top padding could happen here too
              : "px-4 sm:px-6 md:px-8 py-4" // REDUCED TOP PADDING FOR DASHBOARDS
          }
        >
          {children}
        </div>
      </main>
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center px-6">

            {/* Spinner */}
            <div className="h-10 w-10 rounded-full border-4 border-[#2a00b7]/30 border-t-[#2a00b7] animate-spin" />

            {/* Message */}
            <p className="text-lg font-medium text-foreground">
              {LOGOUT_MESSAGES[logoutMessageIndex]}
            </p>

            {/* Subtext */}
            <p className="text-sm text-muted-foreground">
              You’ll be redirected shortly.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};