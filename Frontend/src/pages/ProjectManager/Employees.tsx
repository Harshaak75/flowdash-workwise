import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  FolderKanban,
  CalendarDays,
  ListChecks,
  Plus,
  ArrowRight,
  User,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Send,
  Trash2,
  Loader2,
  Zap,
  MessageCircleDashed,
  CheckIcon,
  Upload, // Added Upload icon for files
} from "lucide-react";
import { Layout } from "@/components/Layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// --- Type Definitions (omitted for brevity, assume they are the same) ---
interface Comment {
  id: string;
  content: string;
  authorId: string;
  author: { id: string; email: string; role: string };
  seenByAssignee: boolean;
  seenByManager: boolean;
  createdAt: string;
}
interface Task {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate?: string;
  fileUrl_manager?: string;
  fileUrl_operator?: string;
  updatedAt: string;
}
interface EmployeeResponse {
  employees: Employee[];
  TaskCompletedCount: number;
}
interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
  tasks: Task[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const PRIMARY_COLOR = "#0000cc";
const ACCENT_RED = "#D70707";

// --- Utility Functions (omitted for brevity, assume they are the same) ---
const getStatusBadgeClass = (status: Task["status"]): string => {
  switch (status) {
    case "DONE":
      return "bg-green-100 text-green-700 hover:bg-green-200 border-green-300";
    case "IN_PROGRESS":
      return "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-300";
    case "TODO":
      return "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const getPriorityColor = (priority: Task["priority"]): string => {
  switch (priority) {
    case "HIGH":
      return "bg-red-600";
    case "MEDIUM":
      return "bg-amber-500";
    case "LOW":
      return "bg-[#0000cc]";
    default:
      return "bg-gray-500";
  }
};

// --- SKELETON LOADER COMPONENT (Responsive updates already applied) ---
const SkeletonEmployeeManagerDashboard = () => {
  // Helper component for a list item placeholder
  const EmployeeListSkeletonItem = () => (
    <div className="p-3 rounded-lg flex items-center gap-3 bg-gray-50 animate-pulse border border-gray-200">
      <div className="h-5 w-5 bg-gray-300 rounded-full"></div>
      <div>
        <div className="h-4 w-28 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 w-20 bg-gray-100 rounded"></div>
      </div>
    </div>
  );

  // Helper component for task table rows
  const TaskRowSkeleton = () => (
    <tr className="border-b last:border-b-0 animate-pulse hidden md:table-row">
      {" "}
      {/* Hide table rows on mobile */}
      <td className="px-6 py-4">
        <div className="h-4 w-48 bg-gray-200 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-6 w-16 bg-gray-100 rounded-full"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-20 bg-gray-100 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-16 bg-gray-100 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-16 bg-gray-100 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
      </td>
    </tr>
  );

  // Mobile Card Skeleton for task rows
  const TaskCardSkeleton = () => (
    <div className="md:hidden p-3 border-b last:border-b-0 animate-pulse bg-white border border-gray-200 rounded-lg">
      <div className="h-4 w-2/3 bg-gray-300 rounded mb-2"></div>
      <div className="flex items-center justify-between gap-4">
        <div className="h-6 w-1/4 bg-gray-100 rounded-full"></div>
        <div className="h-6 w-1/4 bg-gray-200 rounded-full"></div>
        <div className="h-4 w-1/4 bg-gray-100 rounded"></div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 min-h-screen">
        {/* Skeleton Header and Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-3 sm:pb-4 animate-pulse">
          <div>
            <div className="h-7 w-48 sm:h-8 sm:w-80 bg-gray-300 rounded mb-1"></div>
            <div className="h-3 w-64 sm:h-4 sm:w-96 bg-gray-200 rounded mt-1 sm:mt-2"></div>
          </div>
          <div className="flex items-center gap-4 mt-3 sm:mt-0 w-full sm:w-auto justify-between">
            <div className="h-9 w-28 sm:w-32 bg-blue-200 rounded-lg"></div>{" "}
            {/* Create Task Button placeholder */}
            <Card className="p-3 sm:p-4 bg-blue-100/30 border border-blue-200 h-auto w-36 sm:w-48">
              {" "}
              {/* Mini Stat */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
                <div>
                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                  <div className="h-5 w-8 bg-gray-300 rounded mt-1"></div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Content Skeleton Grid - Stacked on mobile */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 xl:grid-cols-4">
          {/* Employee List Skeleton (Column 1) */}
          <Card className="lg:col-span-1 p-4 overflow-y-auto shadow-lg border-gray-200 h-[300px] lg:h-[calc(100vh-160px)]">
            <CardHeader className="px-2 pt-1 pb-4 animate-pulse">
              <div className="h-6 w-32 bg-gray-300 rounded"></div>
            </CardHeader>
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <EmployeeListSkeletonItem key={i} />
              ))}
            </div>
          </Card>

          {/* Employee Detail/Tabs Skeleton (Columns 2-4) */}
          <Card className="lg:col-span-2 xl:col-span-3 h-[calc(100vh-160px)] flex flex-col shadow-lg border-gray-200 animate-pulse">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2">
              <div>
                <div className="h-7 w-48 sm:w-64 bg-gray-300 rounded"></div>
                <div className="h-3 w-72 bg-gray-200 rounded mt-2"></div>
              </div>
            </CardHeader>
            <div className="flex flex-col flex-1">
              <CardHeader className="pt-2 pb-0">
                <div className="grid w-full sm:w-[300px] grid-cols-2 bg-gray-100 p-1 rounded-md">
                  <div className="h-8 bg-gray-300/50 rounded-md"></div>
                  <div className="h-8 bg-gray-300/50 rounded-md"></div>
                </div>
              </CardHeader>
              <Separator className="my-0" />
              <CardContent className="p-4 sm:p-6 flex-1 overflow-y-auto">
                {/* Ongoing Tasks Table/Card Skeleton */}
                <Card className="flex-1 border-gray-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="h-6 w-52 bg-red-100 rounded"></div>
                  </CardHeader>

                  {/* Desktop Table */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-gray-500 uppercase text-xs font-semibold">
                        {/* ... Table Headers ... */}
                      </thead>
                      <tbody>
                        {Array.from({ length: 3 }).map((_, i) => (
                          <TaskRowSkeleton key={i} />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-2 p-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TaskCardSkeleton key={i} />
                    ))}
                  </div>
                </Card>
              </CardContent>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
// --- END SKELETON LOADER COMPONENT ---

// --- StatsCardWrapper (To pass down responsive classes easily) ---
const StatsCardWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full flex flex-col">{children}</div>
);
// -----------------------------------------------------------------

// --- Task Action Menu (No changes needed) ---
const TaskActionMenu = ({
  task,
  currentEmployeeId,
  onTaskTransfer,
  onTaskDelete,
  employees,
  setActiveCommentTask,
  onEditTask, // CHANGED: Renamed from setEditTask to onEditTask
}: {
  task: Task;
  currentEmployeeId: string;
  onTaskTransfer: (taskId: string, newEmployeeId: string) => void;
  onTaskDelete: (taskId: string) => void;
  employees: Employee[];
  setActiveCommentTask: React.Dispatch<React.SetStateAction<Task | null>>;
  onEditTask: (task: Task) => void; // CHANGED Type
}) => {
  const otherEmployees = employees.filter(
    (emp) => emp.id !== currentEmployeeId
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-7 w-7 p-0 ml-1 text-[#0000cc]">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-white shadow-xl rounded-lg text-sm"
      >
        <DropdownMenuLabel className="text-[#0000cc] font-semibold">
          Task Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* ... (Transfer Submenu remains the same) ... */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="hover:bg-blue-50 cursor-pointer text-sm">
            <Send className="mr-2 h-4 w-4 text-red-500" />
            <span>Move To...</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-white shadow-lg">
            {/* ... (Content remains the same) ... */}
            {otherEmployees.length > 0 ? (
              otherEmployees.map((emp) => (
                <DropdownMenuItem
                  key={emp.id}
                  onClick={() => onTaskTransfer(task.id, emp.id)}
                  className="cursor-pointer hover:bg-blue-50 text-sm"
                >
                  <User className="mr-2 h-4 w-4 text-[#0000cc]" />
                  {emp.name}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                No other employees available
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem
          className="text-black focus:bg-red-50 focus:text-red-600 cursor-pointer hover:bg-red-50 text-sm"
          onClick={() => setActiveCommentTask(task)}
        >
          <MessageCircleDashed className="mr-2 h-4 w-4 text-red-600 " />
          Comments
        </DropdownMenuItem>

        {/* UPDATED EDIT BUTTON */}
        <DropdownMenuItem
          className="cursor-pointer hover:bg-blue-50 text-sm"
          onClick={() => onEditTask(task)} // Trigger the parent handler
        >
          ✏️ Edit Task
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer hover:bg-red-50 text-sm"
          onClick={() => onTaskDelete(task.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const EmployeeCalendarView = ({ employee }: { employee: Employee }) => {
  // Simple check for valid date to avoid showing 'Invalid Date'
  const isValidDate = (date: any) => date && !isNaN(new Date(date).getTime());

  const completedTasks = employee.tasks.filter(
    (t) => t.status === "DONE" && isValidDate(t.dueDate)
  );
  // Create a sorted list of unique completion dates
  const completedDates = [
    ...new Set(completedTasks.map((t) => t.dueDate)),
  ].sort();

  return (
    <Card className="h-full border-[#0000cc]/20 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2 text-[#0000cc]">
          <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
          Completed Task Calendar
        </CardTitle>
      </CardHeader>
      {/* Responsive Content Area */}
      <CardContent className="overflow-y-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-350px)] p-4 pt-0">
        {completedDates.length > 0 ? (
          <div className="space-y-4">
            {completedDates.map((date) => (
              <div
                key={date}
                className="border-l-4 border-green-500 pl-4 py-3 bg-green-50 rounded-r-md shadow-sm"
              >
                <p className="font-bold text-sm sm:text-base mb-1 text-green-800">
                  {new Date(date as string).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <ul className="text-sm text-green-700 list-disc list-inside space-y-1">
                  {completedTasks
                    .filter((t) => t.dueDate === date)
                    .map((task) => (
                      <li
                        key={task.id}
                        className="text-green-700/90 text-xs sm:text-sm"
                      >
                        {task.title}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 text-green-500/80" />
            <p className="font-medium text-sm">No completed tasks on record.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- Task Comment Panel (No changes needed) ---
const TaskCommentPanel = ({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) => {
  const token = localStorage.getItem("token");
  const currentUserRole = localStorage.getItem("role") || "MANAGER";
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();

  const fetchComments = useCallback(async () => {
    try {
      const { data } = await axios.get<Comment[]>(
        `${API_BASE_URL}/comments/${task.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Backend returns array directly
      setComments(data);

      // scroll to latest
      setTimeout(() => {
        const container = document.getElementById("comment-container");
        if (container) container.scrollTop = container.scrollHeight;
      }, 50);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error Loading Comments",
        description: "Please refresh page or try again.",
        variant: "destructive",
      });
    }
  }, [task.id, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await axios.post(
        `${API_BASE_URL}/comments/${task.id}`,
        { content: newComment },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setNewComment("");

      // Fetch updated thread
      await fetchComments();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to add comment.",
        variant: "destructive",
      });
    }
  };

  // ... rest of the TaskCommentPanel implementation ...

  return (
    // Responsive Modal Placement: Fixed corner on desktop, full screen on mobile
    <div className="fixed right-0 bottom-0 sm:right-6 sm:bottom-6 w-full sm:w-96 h-full sm:h-[480px] bg-white rounded-t-xl sm:rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-sm truncate">
          {task.title} — Comments
        </h3>
        <button
          onClick={onClose}
          className="hover:bg-white/20 rounded-full p-1 transition"
        >
          ✕
        </button>
      </div>

      {/* Chat Messages - SCROLLABLE AREA */}
      <div
        id="comment-container"
        className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-gray-50"
      >
        {comments.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-10">
            No comments yet — start the conversation 👋
          </p>
        )}

        {comments.map((c) => {
          const isOwnRole = c.author.role === currentUserRole;
          const seen =
            currentUserRole === "MANAGER" ? c.seenByManager : c.seenByAssignee;
          const tickColor = seen ? "text-blue-500" : "text-gray-400";

          return (
            <div
              key={c.id}
              className={`flex ${isOwnRole ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-3 py-2 rounded-2xl text-xs sm:text-sm shadow-sm relative ${isOwnRole
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
                  }`}
              >
                <p className="break-words">{c.content}</p>

                {/* Timestamp + Seen tick */}
                <div className="flex items-center justify-end gap-1 text-[9px] sm:text-[10px] mt-1 opacity-80">
                  <span>
                    {new Date(c.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isOwnRole && (
                    <CheckIcon className={`h-3 w-3 ${tickColor}`} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area - FIXED BOTTOM */}
      <div className="border-t border-gray-200 p-3 bg-white flex items-center gap-2 flex-shrink-0">
        <Input
          placeholder="Type a message..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1 bg-gray-100 focus-visible:ring-1 focus-visible:ring-blue-500 text-sm"
        />
        <Button
          onClick={handleAddComment}
          disabled={!newComment.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 rounded-xl shadow"
        >
          Send
        </Button>
      </div>
    </div>
  );
};

// --- Employee Task View (Updated for Mobile Cards) ---
const EmployeeTaskView = ({
  employee,
  allEmployees,
  fetchEmployees,
  setSelectedEmployee,
  taskCompleted,
  onEditTask, // NEW PROP
}: {
  employee: Employee;
  allEmployees: Employee[];
  fetchEmployees: () => Promise<void>;
  setSelectedEmployee: (emp: Employee) => void;
  taskCompleted: number;
  onEditTask: (task: Task) => void; // NEW PROP TYPE
}) => {
  const [loadingTasks, setLoadingTasks] = useState(false);
  const token = localStorage.getItem("token");
  const { toast } = useToast();

  // REMOVED: const [editTask, setEditTask] = useState... (Duplicate state removed)

  const ongoingTasks = employee.tasks.filter((t) => t.status !== "DONE");
  const completedTasks = employee.tasks.filter((t) => t.status === "DONE");
  const [activeCommentTask, setActiveCommentTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // ... (confirmDelete, showDeleteDialog, handleTaskTransfer, handlePriorityChange remain the same) ...

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setLoadingTasks(true);
    try {
      await axios.delete(`${API_BASE_URL}/tasks/${taskToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchEmployees();
      toast({ title: "Task Deleted", variant: "default" });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete task.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      setLoadingTasks(false);
    }
  };

  const showDeleteDialog = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const handleTaskTransfer = async (taskId: string, newEmployeeId: string) => {
    setLoadingTasks(true);
    try {
      await axios.post(
        `${API_BASE_URL}/tasks/${taskId}/transfer`,
        { newEmployeeId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchEmployees();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to transfer task." });
    } finally {
      setLoadingTasks(false);
    }
  };

  const handlePriorityChange = async (taskId: string, newPriority: string) => {
    setLoadingTasks(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/tasks/${taskId}/priority`,
        { priority: newPriority },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchEmployees();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update priority." });
    } finally {
      setLoadingTasks(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col relative">
      {loadingTasks && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 rounded-xl">
          <Loader2 className="h-8 w-8 text-[#0000cc] animate-spin" />
        </div>
      )}

      {/* Ongoing Tasks */}
      <Card className="flex-1 border-[#0000cc]/20 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2 text-[#0000cc]">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />{" "}
            Ongoing Tasks ({ongoingTasks.length})
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Tasks currently assigned, in progress, or on hold.
          </CardDescription>
        </CardHeader>

        {/* --- DESKTOP TABLE VIEW --- */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm">
            {/* ... (Thead remains same) ... */}
            <thead className="bg-[#0000cc]/10 text-[#0000cc] uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-3">Task</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Manager File</th>
                <th className="px-6 py-3">Operations File</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ongoingTasks.map((task: any) => (
                <tr
                  key={task.id}
                  className="border-b last:border-b-0 hover:bg-gray-50 transition"
                >
                  {/* ... (Other columns remain same) ... */}
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {task.title}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant="default"
                      className={`text-xs ${getStatusBadgeClass(task.status)}`}
                    >
                      {task.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Select
                      value={task.priority}
                      onValueChange={(v) => handlePriorityChange(task.id, v)}
                    >
                      <SelectTrigger
                        className={`w-[90px] h-7 text-white text-xs font-medium rounded-full border-0 ${getPriorityColor(
                          task.priority
                        )}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white shadow-lg rounded-md">
                        <SelectItem value="HIGH" className="text-red-600">
                          High
                        </SelectItem>
                        <SelectItem value="MEDIUM" className="text-amber-600">
                          Medium
                        </SelectItem>
                        <SelectItem value="LOW" className="text-blue-700">
                          Low
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-xs">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {task.fileUrl_manager ? (
                      <a
                        href={task.fileUrl_manager}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 font-medium hover:underline"
                      >
                        View File
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {task.fileUrl_operator ? (
                      <a
                        href={task.fileUrl_operator}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 font-medium hover:underline"
                      >
                        View File
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <TaskActionMenu
                      task={task}
                      currentEmployeeId={employee.id}
                      onTaskTransfer={handleTaskTransfer}
                      onTaskDelete={showDeleteDialog}
                      employees={allEmployees}
                      setActiveCommentTask={setActiveCommentTask}
                      onEditTask={onEditTask} // PASSED DOWN
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- MOBILE CARD VIEW --- */}
        <div className="space-y-3 p-2 md:hidden">
          {ongoingTasks.map((task: any) => (
            <div
              key={task.id}
              className="p-3 border border-gray-200 rounded-lg bg-white shadow-sm"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-sm text-gray-800 break-words pr-2">
                  {task.title}
                </h4>
                <TaskActionMenu
                  task={task}
                  currentEmployeeId={employee.id}
                  onTaskTransfer={handleTaskTransfer}
                  onTaskDelete={showDeleteDialog}
                  employees={allEmployees}
                  setActiveCommentTask={setActiveCommentTask}
                  onEditTask={onEditTask} // PASSED DOWN
                />
              </div>
              {/* ... (Rest of Mobile View remains same) ... */}
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-gray-500">Status</span>
                  <Badge
                    variant="default"
                    className={`w-fit mt-1 text-[10px] ${getStatusBadgeClass(
                      task.status
                    )}`}
                  >
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
                {/* ... Priority Select ... */}
                <div className="flex flex-col items-end">
                  <span className="text-gray-500">Priority</span>
                  <div className="pt-1">
                    <Select
                      value={task.priority}
                      onValueChange={(v) => handlePriorityChange(task.id, v)}
                    >
                      <SelectTrigger
                        className={`w-[75px] h-6 text-white text-[10px] font-medium rounded-full border-0 ${getPriorityColor(
                          task.priority
                        )}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {/* ... Due Date and Files sections ... */}
            </div>
          ))}
        </div>
      </Card>

      {activeCommentTask && (
        <TaskCommentPanel
          task={activeCommentTask}
          onClose={() => setActiveCommentTask(null)}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        {/* ... (Delete Dialog Content remains same) ... */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete this task? This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button
              className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={loadingTasks}
              className="px-4 py-2 rounded bg-[#0000CC] text-white hover:bg-[#0000ccaa]"
              onClick={confirmDelete}
            >
              {loadingTasks ? "Deleting..." : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --- Main Dashboard Component ---
export function EmployeeManagerDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [editTask, setEditTask] = useState<Task | null>(null);
  const isEditMode = Boolean(editTask);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"calendar" | "task">("task");
  const [taskCompltedCount, setTaskCompletedCount] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "",
    notes: "",
    dueDate: "",
    priority: "MEDIUM",
    assignedHours: "",
    assigneeEmployeeId: "",
    file: null as File | null,
  });

  // NEW FUNCTION: Handle opening the edit dialog
  const handleOpenEditDialog = (task: Task) => {
    setEditTask(task);
    setIsDialogOpen(true);
  };

  // This Effect listens for editTask changes and populates form (this was already correct)
  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title,
        notes: "", // Note: If your API returns notes, map it here. ex: editTask.notes || ""
        dueDate: editTask.dueDate?.split("T")[0] || "",
        priority: editTask.priority,
        assignedHours: "", // Note: If your API returns assignedHours, map it here.
        assigneeEmployeeId: selectedEmployee?.id || "",
        file: null,
      });
      // Important: Ensure Dialog opens if setEditTask is called from elsewhere,
      // though handleOpenEditDialog covers this.
      setIsDialogOpen(true);
    }
  }, [editTask, selectedEmployee]);

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditTask(null);
      resetForm();
    }
  };

  const token = localStorage.getItem("token");

  // Fetch Employees with Tasks
  const fetchEmployees = useCallback(async () => {
    // ... fetch logic
    setLoading(true);
    try {
      const { data } = await axios.get<EmployeeResponse>(
        `${API_BASE_URL}/employees/employees`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Map through employees and filter their task arrays
      const employeesWithActiveTasks = data.employees.map((employee: any) => ({
        ...employee,
        tasks: employee.tasks.filter((task: any) => task.status !== "Done")
      }));

      console.log("Employees with filtered active tasks: ", employeesWithActiveTasks);

      // Set the state with the filtered data
      setEmployees(employeesWithActiveTasks);
      setTaskCompletedCount(data.TaskCompletedCount);

    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Handle selected employee persistence/update
  useEffect(() => {
    if (employees.length > 0) {
      const existing = employees.find((emp) => emp.id === selectedEmployee?.id);
      if (existing) {
        setSelectedEmployee(existing);
      } else {
        setSelectedEmployee(employees[0]);
      }
    } else {
      setSelectedEmployee(null);
    }
  }, [employees]);

  // Form Handlers (omitted for brevity)
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }));
  };

  const resetForm = () => {
    setForm({
      title: "",
      notes: "",
      dueDate: "",
      priority: "MEDIUM",
      assignedHours: "",
      assigneeEmployeeId: "",
      file: null,
    });
  };

  const COLOR_PRIMARY = "#0000cc"; // Deep Blue
  const COLOR_ACCENT_ICON = "text-red-500"; // Red
  const COLOR_SUCCESS = "#10b981"; // Green for completion

  const CompletedCalendarView = ({ employeeId }: { employeeId: string }) => {
    // ... (CompletedCalendarView logic remains the same, but using responsive text sizes)
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem("token");

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${API_BASE_URL}/tasks/${employeeId}/completed`,
          {
            headers: {
              authorization: `Bearer ${token}`,
            },
          }
        );
        setTasks(res.data.tasks || []);
      } catch (err) {
        console.error("Failed to fetch tasks", err);
      }
      setLoading(false);
    };

    useEffect(() => {
      fetchTasks();
    }, []);

    const completedByDate: Record<string, Task[]> = tasks.reduce(
      (acc, task) => {
        const date = task.updatedAt.split("T")[0];
        acc[date] = acc[date] || [];
        acc[date].push(task);
        return acc;
      },
      {} as Record<string, Task[]>
    );

    const sortedDates = Object.keys(completedByDate).sort().reverse();

    return (
      <CardContent className="p-0 space-y-4">
        <CardHeader className="p-0 pb-4">
          {/* Title: Smaller on mobile (text-lg) */}
          <CardTitle
            className="text-lg sm:text-xl flex items-center gap-2"
            style={{ color: COLOR_PRIMARY }}
          >
            <CalendarDays
              className={`h-4 w-4 sm:h-5 sm:w-5 ${COLOR_ACCENT_ICON}`}
            />
            Completed Task History
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            A chronological log of all tasks you have marked as 'Completed'.
          </CardDescription>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2
              className={`h-6 w-6 animate-spin`}
              style={{ color: COLOR_PRIMARY }}
            />
          </div>
        ) : sortedDates.length > 0 ? (
          <div className="space-y-4 sm:space-y-6">
            {" "}
            {/* Reduced vertical space on mobile */}
            {sortedDates.map((date) => (
              <div
                key={date}
                className="border-l-4 pl-3 sm:pl-4 py-2 sm:py-3 rounded-r-md shadow-sm" // Reduced padding
                style={{
                  borderColor: COLOR_SUCCESS,
                  backgroundColor: `${COLOR_SUCCESS}10`,
                }}
              >
                <p
                  className="font-bold text-sm sm:text-base mb-1" // Reduced text size
                  style={{ color: COLOR_SUCCESS }}
                >
                  {new Date(date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <ul className="space-y-1">
                  {" "}
                  {/* Reduced vertical space */}
                  {completedByDate[date].map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 text-xs sm:text-sm text-green-800" // Reduced text size
                    >
                      <CheckCircle2
                        className={`h-3 w-3 sm:h-4 sm:w-4 text-green-600`}
                      />{" "}
                      {/* Reduced icon size */}
                      <span className="font-medium">{task.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 sm:py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
            <ListChecks
              className={`h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3`} // Reduced icon size
              style={{ color: COLOR_PRIMARY }}
            />
            <p className="text-sm">
              No completed tasks logged yet this period.
            </p>
          </div>
        )}
      </CardContent>
    );
  };

  const handleSubmitTask = async () => {
    const today = new Date().toISOString().split("T")[0];

    if (form.dueDate && form.dueDate < today) {
      toast({
        title: "Invalid Due Date",
        description: "Due date cannot be in the past.",
        variant: "destructive",
      });
      return;
    }
    if (!form.title.trim() || !form.assignedHours) {
      toast({
        title: "Error",
        description: "Title and Assigned Hours are required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      if (isEditMode && editTask) {
        // 🔄 EDIT TASK
        const formData = new FormData();

        // 1. Append text fields
        formData.append("title", form.title);
        formData.append("priority", form.priority);
        formData.append("assignedHours", form.assignedHours);

        // Append optional text fields only if they exist
        if (form.dueDate) formData.append("dueDate", form.dueDate);
        if (form.notes) formData.append("notes", form.notes);

        // 2. Append the file ONLY if the user selected a new one
        if (form.file) {
          formData.append("file", form.file);
        }

        // 3. Send via PATCH
        await axios.patch(
          `${API_BASE_URL}/tasks/${editTask.id}`,
          formData, // Send the FormData object, not JSON
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data", // Important for file uploads
            },
          }
        );

        toast({ title: "Task Updated Successfully" });
      } else {
        // ➕ CREATE TASK
        const formData = new FormData();
        formData.append("title", form.title);
        formData.append("priority", form.priority);
        formData.append("assignedHours", form.assignedHours);
        formData.append("assigneeEmployeeId", form.assigneeEmployeeId);
        if (form.dueDate) formData.append("dueDate", form.dueDate);
        if (form.notes) formData.append("notes", form.notes);
        if (form.file) formData.append("file", form.file);

        await axios.post(`${API_BASE_URL}/tasks/create`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        toast({ title: "Task Created Successfully" });
      }

      setIsDialogOpen(false);
      setEditTask(null);
      resetForm();
      await fetchEmployees();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save task",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Loading and Error States
  if (loading) return <SkeletonEmployeeManagerDashboard />;

  if (error)
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
    );

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 min-h-screen">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-3 sm:pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0000cc]">
              Team Manager Console
            </h1>
            <p className="text-sm sm:text-base text-gray-500">
              Oversee team assignments and performance in a single view.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 mt-3 sm:mt-0 w-full sm:w-auto justify-between">
            {/* UPDATED DIALOG TRIGGER */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button
                  size="default"
                  onClick={() => {
                    setEditTask(null); // Ensure we are in Create mode
                    resetForm();
                  }}
                  className="gap-2 bg-[#0000cc] hover:bg-[#0000cc]/90 text-white rounded-lg shadow-md text-sm"
                >
                  <Plus className="h-4 w-4 text-red-500" /> Create Task
                </Button>
              </DialogTrigger>
              <DialogContent className="w-11/12 max-w-[95vw] sm:max-w-[600px] h-[95vh] sm:h-auto max-h-[95vh] bg-white rounded-xl shadow-xl">
                {/* ... (Form Content remains essentially the same) ... */}
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-[#0000cc]">
                    {isEditMode ? "Edit Task" : "Assign New Task"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditMode
                      ? "Update task details below."
                      : "Fill in the required details to create and assign a new task."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2 flex-1 overflow-y-auto pr-2">
                  {/* ... Form Inputs (Title, AssignTo, Priority, DueDate, Hours, Notes, File) ... */}
                  {/* Make sure inputs allow editing, e.g. value={form.title} */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="title" className="text-gray-700">
                      Title*
                    </Label>
                    <Input
                      id="title"
                      name="title"
                      value={form.title}
                      onChange={handleFormChange}
                      required
                      className="border-gray-300 focus:border-[#0000cc]"
                    />
                  </div>
                  {/* ... Rest of inputs ... */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="assigneeEmployeeId"
                      className="text-gray-700"
                    >
                      Assign To*
                    </Label>
                    <Select
                      value={form.assigneeEmployeeId}
                      onValueChange={(v) =>
                        handleSelectChange("assigneeEmployeeId", v)
                      }
                    >
                      <SelectTrigger className="border-gray-300 focus:ring-[#0000cc]">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-gray-700">
                      Priority
                    </Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => handleSelectChange("priority", v)}
                    >
                      <SelectTrigger className="border-gray-300 focus:ring-[#0000cc]">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate" className="text-gray-700">
                      Due Date
                    </Label>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={form.dueDate}
                      onChange={handleFormChange}
                      className="border-gray-300 focus:border-[#0000cc]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedHours" className="text-gray-700">
                      Assigned Hours (Hrs)*
                    </Label>
                    <Input
                      id="assignedHours"
                      name="assignedHours"
                      type="number"
                      value={form.assignedHours}
                      onChange={handleFormChange}
                      placeholder="e.g., 8.0"
                      step="0.5"
                      className="border-gray-300 focus:border-[#0000cc]"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes" className="text-gray-700">
                      Notes
                    </Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={form.notes}
                      onChange={handleFormChange}
                      rows={3}
                      className="border-gray-300 focus:border-[#0000cc]"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="file" className="text-gray-700">
                      Attachment (optional)
                    </Label>
                    <Input
                      id="file"
                      name="file"
                      type="file"
                      onChange={handleFileChange}
                      className="border-gray-300 focus:border-[#0000cc]"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4 flex-shrink-0">
                  <Button
                    onClick={handleSubmitTask}
                    disabled={
                      !form.title.trim() ||
                      !form.assigneeEmployeeId ||
                      !form.assignedHours ||
                      isCreating
                    }
                    className="bg-[#0000cc] hover:bg-[#0000cc]/90 text-white"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : isEditMode ? (
                      "Update Task"
                    ) : (
                      "Create Task"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Card className="p-2 sm:p-3 bg-[#0000cc]/10 border border-[#0000cc]/30 shadow-sm w-fit">
              {/* ... (Total Employees Card remains same) ... */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                <div>
                  <div className="text-[10px] sm:text-xs font-medium text-gray-600">
                    Total Employees
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#0000cc]">
                    {employees.length}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 xl:grid-cols-4 h-auto lg:h-[calc(100vh-160px)]">
          {/* ... (Employee List Column remains same) ... */}
          <Card className="lg:col-span-1 p-4 overflow-y-auto shadow-lg border-[#0000cc]/20 h-[300px] lg:h-full">
            <CardHeader className="px-2 pt-1 pb-4">
              <CardTitle className="text-lg sm:text-xl text-[#0000cc]">
                Team Roster
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className={`p-3 rounded-lg cursor-pointer flex items-center justify-between transition-all duration-150 text-sm ${selectedEmployee?.id === emp.id
                    ? "bg-[#0000cc] text-white shadow-md"
                    : "hover:bg-gray-100 border border-gray-200"
                    }`}
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <div className="flex items-center gap-3">
                    <User
                      className={`h-4 w-4 ${selectedEmployee?.id === emp.id
                        ? "text-red-500"
                        : "text-[#0000cc]"
                        }`}
                    />
                    <div>
                      <h4 className="font-semibold leading-none">{emp.name}</h4>
                      <p
                        className={`text-xs ${selectedEmployee?.id === emp.id
                          ? "text-white/80"
                          : "text-gray-500"
                          }`}
                      >
                        {emp.role}
                      </p>
                    </div>
                  </div>
                  {selectedEmployee?.id === emp.id && (
                    <ArrowRight className="h-4 w-4 text-red-500" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="lg:col-span-2 xl:col-span-3">
            {selectedEmployee ? (
              <Card className="h-full flex flex-col shadow-lg border-[#0000cc]/20">
                {/* ... (Tabs Header remains same) ... */}
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0000cc]">
                      {selectedEmployee.name}'s Performance
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedEmployee.role} | {selectedEmployee.email}
                    </p>
                  </div>
                </CardHeader>
                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    setActiveTab(value as "calendar" | "task")
                  }
                  className="flex flex-col flex-1"
                >
                  {/* ... (Tabs List remains same) ... */}
                  <CardHeader className="pt-2 pb-0">
                    <TabsList className="grid w-full sm:w-[300px] grid-cols-2 bg-gray-100 p-1">
                      <TabsTrigger
                        value="calendar"
                        className="data-[state=active]:bg-[#0000cc] data-[state=active]:text-white transition-all text-xs sm:text-sm text-gray-600"
                      >
                        <CalendarDays className="h-3 w-3 mr-2" /> Task Log
                      </TabsTrigger>
                      <TabsTrigger
                        value="task"
                        className="data-[state=active]:bg-[#0000cc] data-[state=active]:text-white transition-all text-xs sm:text-sm text-gray-600"
                      >
                        <FolderKanban className="h-3 w-3 mr-2" /> Active Tasks
                      </TabsTrigger>
                    </TabsList>
                  </CardHeader>
                  <Separator className="my-0" />
                  <CardContent className="p-4 sm:p-6 flex-1 overflow-y-auto">
                    <TabsContent value="calendar" className="h-full m-0">
                      <CompletedCalendarView employeeId={selectedEmployee.id} />
                    </TabsContent>
                    <TabsContent value="task" className="h-full m-0">
                      <EmployeeTaskView
                        employee={selectedEmployee}
                        setSelectedEmployee={setSelectedEmployee}
                        allEmployees={employees}
                        fetchEmployees={fetchEmployees}
                        taskCompleted={taskCompltedCount}
                        onEditTask={handleOpenEditDialog} // PASSED FUNCTION HERE
                      />
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-gray-500 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                <p className="p-10 text-lg font-medium">
                  👈 Select an employee from the roster to view their details
                  and tasks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
