"use client";

import { useEffect, useState, ReactNode } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  CalendarDays,
  ListChecks,
  CheckCircle2,
  RotateCw,
  Hourglass,
  Activity,
  Upload,
  FileText,
  Check,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  taskId: string;
  content: string;
  authorId: string;
  author: {
    id: string;
    email: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  seenByAssignee: boolean;
  seenByManager: boolean;
}

interface Task {
  id: string;
  title: string;
  notes?: string;
  status: "TODO" | "WORKING" | "STUCK" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate?: string;
  fileUrl?: string;
  managerFiles?: string[];
  employeeFiles?: string[];
  createdAt: string;
  updatedAt: string;
  assignedHours?: string;
  comments?: Comment[];
  fileUrl_manager?: string;
  fileUrl_operator?: string;
}

const COLOR_PRIMARY = "#0000cc"; // Deep Blue
const COLOR_ACCENT_ICON = "text-red-500"; // Red
const COLOR_SUCCESS = "#10b981"; // Green for completion

type PriorityFilter = Task["priority"] | "all";

// --- Utility Functions (Responsive adjustments made here) ---
const getStatusBadgeStyles = (status: Task["status"]) => {
  switch (status) {
    case "WORKING":
      return `bg-amber-100 text-amber-700 border-amber-300`;
    case "DONE":
      return `bg-green-100 text-green-700 border-green-300`;
    case "TODO":
      return `bg-gray-100 text-gray-700 border-gray-300`;
    case "STUCK":
      return `bg-red-100 text-red-700 border-red-300`;
    default:
      return `bg-gray-100 text-gray-700`;
  }
};

const getPriorityBadgeStyles = (priority: Task["priority"]) => {
  switch (priority) {
    case "HIGH":
      return `bg-red-600 text-white`;
    case "MEDIUM":
      return `bg-amber-500 text-white`;
    case "LOW":
      return `bg-[${COLOR_PRIMARY}] text-white`;
    default:
      return `bg-gray-500 text-white`;
  }
};

const StatusIcon = ({ status }: { status: Task["status"] }) => {
  switch (status) {
    case "WORKING":
      return (
        <RotateCw
          className={`h-4 w-4 sm:h-5 sm:w-5 animate-spin-slow`} // Responsive icon size
          style={{ color: COLOR_PRIMARY }}
        />
      );
    case "DONE":
      return (
        <CheckCircle2 className={`h-4 w-4 sm:h-5 sm:w-5 text-green-600`} />
      ); // Responsive icon size
    case "TODO":
      return <Hourglass className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-500`} />; // Responsive icon size
    case "STUCK":
      return <Activity className={`h-4 w-4 sm:h-5 sm:w-5 text-red-600`} />; // Responsive icon size
    default:
      return <FileText className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-400`} />; // Responsive icon size
  }
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- SKELETON LOADER COMPONENT (Updated to be mobile-friendly) ---

const TaskRowSkeleton = () => (
  // Mobile: Stacks items; LG: Uses the full 10-column grid
  <div className="flex flex-col lg:grid lg:grid-cols-[40px_3fr_2.5fr_1.5fr_1fr_1fr_1fr_2fr_1.5fr_0.8fr] gap-3 lg:gap-5 items-center p-3 sm:p-4 bg-white border border-gray-100 rounded-lg animate-pulse">
    {/* Status Icon (Hidden on Mobile) */}
    <div className="hidden lg:flex justify-center items-center">
      <div className="h-5 w-5 bg-gray-300 rounded-full"></div>
    </div>

    {/* Task Title (Main element on Mobile) */}
    <div className="h-4 w-4/5 bg-gray-200 rounded order-1 lg:order-none lg:h-auto"></div>

    {/* Priority & Deadline (Mobile: Grouped) */}
    <div className="flex flex-row items-center gap-3 order-2 lg:order-none lg:flex-col lg:items-start lg:gap-1">
      <div className="h-4 w-12 bg-gray-300 rounded-full"></div>
      <div className="h-3 w-20 bg-gray-200 rounded"></div>
    </div>

    {/* Status Dropdown (Mobile: Prominent) */}
    <div className="h-8 w-full bg-gray-100 rounded order-3 lg:order-none"></div>

    {/* Manager Files (Hidden on Mobile) */}
    <div className="hidden lg:flex justify-center items-center">
      <div className="h-5 w-5 bg-gray-200 rounded-md"></div>
    </div>

    {/* File Upload (Hidden on Mobile) */}
    <div className="hidden lg:flex justify-center items-center">
      <div className="h-5 w-5 bg-gray-200 rounded-md"></div>
    </div>

    {/* Assigned Hours (Hidden on Mobile) */}
    <div className="hidden lg:flex h-4 w-10 bg-gray-200 rounded mx-auto"></div>

    {/* Notes (Mobile: Secondary text) */}
    <div className="h-4 w-full bg-gray-100 rounded order-4 lg:order-none"></div>

    {/* Updated Time (Hidden on Mobile) */}
    <div className="hidden lg:flex h-6 w-16 bg-gray-100 rounded mx-auto"></div>

    {/* Comments Button (Mobile: Bottom right or its own row) */}
    <div className="flex justify-start w-full order-5 lg:order-none lg:justify-center items-center">
      <div className="h-6 w-6 bg-blue-200 rounded-md"></div>
    </div>
  </div>
);

const SkeletonTaskHub = () => (
  <Layout>
    <div className="space-y-4 sm:space-y-8 p-3 sm:p-6">
      {" "}
      {/* Reduced padding/spacing for mobile */}
      <Card
        className={`p-4 sm:p-6 shadow-lg border-[${COLOR_PRIMARY}]/20 animate-pulse`}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 border-b pb-3 sm:pb-4">
          {/* H1 Title: Smaller on mobile (text-2xl) */}
          <div className="h-7 w-48 sm:h-8 sm:w-64 bg-gray-300 rounded mb-2 sm:mb-0"></div>
          {/* Tabs List: Full width on mobile, smaller on desktop */}
          <div className="h-9 w-full sm:w-[320px] bg-gray-100 rounded-md"></div>
        </div>

        <div className="p-0">
          <CardHeader className="p-0 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
              <div className="h-6 w-40 sm:w-48 bg-blue-200 rounded mb-2 sm:mb-0"></div>
              <div className="h-8 w-full sm:w-[180px] bg-gray-100 rounded"></div>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded"></div>
          </CardHeader>

          {/* Table Header Skeleton (Desktop only) */}
          <div className="hidden lg:grid grid-cols-[40px_3fr_2.5fr_1.5fr_1fr_1fr_1fr_2fr_1.5fr_0.8fr] text-xs font-bold uppercase border-b border-gray-300 px-2 py-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-3 w-12 bg-gray-200 rounded mx-auto"
              ></div>
            ))}
          </div>

          {/* Task Rows Skeleton */}
          <div className="space-y-2 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <TaskRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  </Layout>
);

// --- Task Timeline View ---
const TaskTimelineView = ({ role }: { role: any }) => {
  // ... (State and other functions remain the same)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();

  const token = localStorage.getItem("token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let res: any;
      res =
        role === "OPERATOR"
          ? await axios.get(`${API_BASE_URL}/tasks/EmployeeTasks`)
          : await axios.get(`${API_BASE_URL}/projectManager/ManagerTasks`);

      const fetchedTasks = res.data.tasks || res.data;
      setTasks(fetchedTasks);
    } catch (err) {
      toast({
        title: "Error",
        description: "Error To Fetch the task",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleStatusChange = async (
    taskId: string,
    newStatus: Task["status"]
  ) => {
    try {
      await axios.patch(`${API_BASE_URL}/tasks/${taskId}/status`, {
        status: newStatus,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: newStatus, updatedAt: new Date().toISOString() }
            : t
        )
      );
    } catch (err) {
      if (err.response?.status === 409) {
        const running = err.response.data.runningTask;
        toast({
          title: "Error",
          description: `Please pause current task before starting another.\nRunning task: ${running.title}`,
          variant: "destructive",
        });
      } else {
        console.error("Failed to update status", err);
      }
    }
  };

  const handleFileUpload = async (taskId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/tasks/${taskId}/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                employeeFiles: t.employeeFiles
                  ? [...t.employeeFiles, res.data.fileUrl]
                  : [res.data.fileUrl],
              }
            : t
        )
      );
    } catch (err) {
      console.error("Failed to upload file", err);
    }
  };

  const fetchCommentsForTask = async (taskId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/comments/${taskId}`);
      const comments: Comment[] = res.data.comments || res.data;
      const taskWithComments = tasks.find((t) => t.id === taskId);
      if (taskWithComments) {
        setSelectedTask({ ...taskWithComments, comments });
      }
    } catch (err) {
      console.error("Failed to fetch comments", err);
    }
  };

  const sendComment = async () => {
    if (!selectedTask || !commentText.trim()) return;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/comments/${selectedTask.id}`,
        { content: commentText }
      );

      const newComment: Comment = {
        id: res.data.id,
        taskId: selectedTask.id,
        content: res.data.content,
        authorId: res.data.authorId,
        author: res.data.author,
        createdAt: res.data.createdAt,
        updatedAt: res.data.updatedAt,
        seenByAssignee: res.data.seenByAssignee,
        seenByManager: res.data.seenByManager,
      };

      setSelectedTask((prev) =>
        prev
          ? { ...prev, comments: [...(prev.comments || []), newComment] }
          : prev
      );

      setCommentText("");
    } catch (err) {
      console.error("Failed to send comment", err);
    }
  };

  // ... (filteredTasks and orderedTasks remain the same)
  const filteredTasks = tasks.filter(
    (task) => priorityFilter === "all" || task.priority === priorityFilter
  );
  const orderedTasks = filteredTasks.sort((a, b) => {
    if (a.priority === "HIGH" && b.priority !== "HIGH") return -1;
    if (a.priority !== "HIGH" && b.priority === "HIGH") return 1;
    return (
      new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime()
    );
  });

  return (
    <CardContent className="p-0">
      {/* ... (Header and Table Header sections remain the same) ... */}
      <CardHeader className="p-0 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
          {/* Title: Smaller on mobile (text-lg) */}
          <CardTitle
            className="text-lg sm:text-xl flex items-center gap-2 mb-3 sm:mb-0"
            style={{ color: COLOR_PRIMARY }}
          >
            <Target className={`h-4 w-4 sm:h-5 sm:w-5 ${COLOR_ACCENT_ICON}`} />
            Assigned Tasks ({orderedTasks.length})
          </CardTitle>
          {/* Filter: Full width on mobile */}
          <Select
            value={priorityFilter}
            onValueChange={(value) =>
              setPriorityFilter(value as PriorityFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
              <SelectValue placeholder="Filter by Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription className="text-sm text-gray-500">
          Update your status, upload files, and track your task progress.
        </CardDescription>
      </CardHeader>

      {/* Table Header (Desktop Only) */}
      <div
        className={`hidden lg:grid grid-cols-[40px_3fr_2.5fr_1.5fr_1fr_1fr_1fr_2fr_1.5fr_0.8fr] text-xs font-bold uppercase border-b border-[${COLOR_PRIMARY}]/30 px-2 py-3`}
        style={{ color: COLOR_PRIMARY }}
      >
        <div></div>
        <div>Task & Project</div>
        <div>Priority & Deadline</div>
        <div>Status</div>
        <div className="text-center">Refs</div>
        <div className="text-center">Files</div>
        <div className="text-center">Hours</div>
        <div>Notes</div>
        <div className="text-center">Updated</div>
        <div className="text-center">Chat</div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex flex-col items-center mt-8 gap-3">
          <Loader2
            className={`h-6 w-6 animate-spin`}
            style={{ color: COLOR_PRIMARY }}
          />
          <p className="text-sm text-gray-500 font-medium">Loading tasks...</p>
        </div>
      ) : (
        <div className="space-y-3 mt-3">
          {orderedTasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-3 p-3 sm:p-4 bg-white border border-gray-200 rounded-lg hover:border-[#0000cc]/50 hover:shadow-sm transition-shadow lg:grid lg:grid-cols-[40px_3fr_2.5fr_1.5fr_1fr_1fr_1fr_2fr_1.5fr_0.8fr] lg:gap-5 lg:items-center"
            >
              {/* ... (Task row content remains the same) ... */}

              {/* Status Icon (Desktop Only) */}
              <div className="hidden lg:flex justify-center items-center">
                <StatusIcon status={task.status} />
              </div>

              {/* Task Title & Project (Always visible, Main area) */}
              <div className="flex flex-col gap-1 order-1 lg:order-none">
                <span className="font-semibold text-sm sm:text-base text-gray-800">
                  {task.title}
                </span>
              </div>

              {/* Priority & Deadline */}
              <div className="flex items-center gap-3 order-2 lg:order-none lg:flex-col lg:items-start lg:gap-1">
                <Badge
                  variant="default"
                  className={`capitalize text-xs font-semibold ${getPriorityBadgeStyles(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </Badge>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-xs sm:text-sm text-red-600 font-medium">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Status Dropdown - FIX: Stops propagation to prevent modal opening */}
              <div
                className="order-3 lg:order-none w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <Select
                  value={task.status}
                  onValueChange={(value) =>
                    handleStatusChange(task.id, value as Task["status"])
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs sm:text-sm border-gray-300 hover:border-[#0000cc]">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">TODO</SelectItem>
                    <SelectItem value="WORKING">WORKING</SelectItem>
                    <SelectItem value="STUCK">STUCK</SelectItem>
                    <SelectItem value="DONE">DONE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Secondary Information Container (Mobile: Collapsed/Grouped at the bottom) */}
              <div className="flex items-center justify-between w-full lg:contents order-5 lg:order-none border-t border-gray-100 pt-2 lg:border-t-0 lg:pt-0">
                {/* Manager Files - FIX: Stop propagation on anchor tag clicks */}
                <div className="flex justify-center items-center lg:w-auto w-1/3">
                  {task.fileUrl_manager ? (
                    <a
                      href={task.fileUrl_manager}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Upload className="h-4 w-4 sm:h-5 sm:w-5 cursor-pointer text-blue-600 hover:text-blue-800" />
                    </a>
                  ) : (
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 cursor-pointer text-gray-400" />
                  )}
                </div>

                {/* File Upload - FIX: Stop propagation on label click */}
                <div
                  className="flex justify-center items-center lg:w-auto w-1/3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {task.employeeFiles?.length ? (
                    <a
                      href={task.employeeFiles[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Upload className="h-4 w-4 sm:h-5 sm:w-5 cursor-pointer text-green-600" />
                    </a>
                  ) : (
                    <label>
                      <Upload
                        className={`h-4 w-4 sm:h-5 sm:w-5 cursor-pointer text-gray-400 hover:text-[${COLOR_PRIMARY}]`}
                      />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files &&
                          handleFileUpload(task.id, e.target.files[0])
                        }
                      />
                    </label>
                  )}
                </div>

                {/* Assigned Hours (Mobile: Grouped) */}
                <div className="text-center text-xs sm:text-sm font-semibold text-gray-600 lg:w-auto w-1/3">
                  {task.assignedHours || "-"}h
                </div>
              </div>

              {/* Notes (Desktop Only) */}
              <div
                className="hidden lg:block text-sm text-gray-500 truncate"
                title={task.notes || ""}
              >
                {task.notes || "No notes"}
              </div>

              {/* Updated Time (Desktop Only) */}
              <div className="hidden lg:block text-center text-xs text-gray-600">
                {new Date(task.updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <br />
                {new Date(task.updatedAt).toLocaleDateString()}
              </div>

              {/* Comments Button - EXPLICITLY handles modal opening */}
              <div className="flex justify-center items-center order-4 lg:order-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Stop the click from propagating to the row
                    setSelectedTask(task);
                    fetchCommentsForTask(task.id);
                  }}
                  className="hover:bg-gray-100 p-2 rounded-md transition"
                >
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </button>
              </div>
            </div>
          ))}

          {/* 🚀🚀🚀 RESPONSIVE COMMENT MODAL FIX (Final Design) 🚀🚀🚀 */}
          {selectedTask && (
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-3 sm:p-4 z-50">
              <div
                className="bg-white rounded-lg shadow-2xl flex flex-col
                                w-full h-full max-w-sm 
                                sm:max-w-[600px] sm:h-auto 
                                max-h-[95vh] sm:max-h-[80vh] 
                                p-4 sm:p-6 relative"
              >
                {/* NOTE: Using flex-col here to manage vertical space */}

                {/* Close Button */}
                <button
                  className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
                  onClick={() => setSelectedTask(null)}
                >
                  ✕
                </button>

                {/* Header & Task Info */}
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold">
                    {selectedTask.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {selectedTask.notes || "No notes"}
                  </p>
                </div>

                {/* Comments Title */}
                <h3 className="font-semibold text-sm text-gray-700 mb-2">
                  Comments
                </h3>

                {/* Comments List Container - SCROLLABLE AREA */}
                <div className="flex-1 overflow-y-auto pr-2 mb-4 space-y-2 border border-gray-200 p-2 rounded bg-gray-50">
                  {selectedTask.comments?.length ? (
                    selectedTask.comments.map((c: Comment) => {
                      const currentUserRole = localStorage.getItem("userRole");
                      const isOwnRole = c.author.role === currentUserRole;
                      const seen =
                        currentUserRole === "OPERATOR"
                          ? c.seenByAssignee
                          : c.seenByManager;

                      const tickColor = seen
                        ? "text-blue-500"
                        : "text-gray-400";

                      return (
                        <div
                          key={c.id}
                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-600 p-2 bg-white rounded shadow-sm"
                        >
                          <div className="break-words w-full sm:w-auto">
                            <span className="font-medium">
                              {c.author.email.split("@")[0]}:
                            </span>{" "}
                            {c.content}
                          </div>

                          {!isOwnRole && (
                            <Check
                              className={`h-4 w-4 mt-1 sm:mt-0 sm:ml-2 ${tickColor} flex-shrink-0`}
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-400 p-2">No comments yet</p>
                  )}
                </div>

                {/* Input/Send Area - FIXED at the bottom of the modal */}
                <div className="flex gap-2 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0000cc]"
                  />
                  <button
                    className="bg-[#0000cc] text-white px-3 py-2 rounded text-sm hover:bg-[#000099] flex-shrink-0"
                    onClick={sendComment}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* ... (Rest of the component code) ... */}
        </div>
      )}
    </CardContent>
  );
};

// --- Completed Calendar View ---
const CompletedCalendarView = () => {
  // ... (CompletedCalendarView logic remains the same, but using responsive text sizes)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/tasks/EmployeeTasks`);
      const completed = res.data.tasks.filter((t: Task) => t.status === "DONE");
      setTasks(completed);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const completedByDate: Record<string, Task[]> = tasks.reduce((acc, task) => {
    const date = task.updatedAt.split("T")[0];
    acc[date] = acc[date] || [];
    acc[date].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

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
          <p className="text-sm">No completed tasks logged yet this period.</p>
        </div>
      )}
    </CardContent>
  );
};

// --- Main Component ---
export default function EmployeeTaskTimeline() {
  const [activeTab, setActiveTab] = useState<"timeline" | "calendar">(
    "timeline"
  );
  const [role, setRole] = useState(null);

  // Simulating loading role initially (Remove this in production if role is fetched via context/auth)
  useEffect(() => {
    const userRole = localStorage.getItem("userRole") || "OPERATOR";
    setRole(userRole);
  }, []);

  if (!role) {
    return <SkeletonTaskHub />;
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-8 p-4 sm:p-6">
        {" "}
        {/* Reduced padding/spacing for mobile */}
        <Card className={`p-4 sm:p-6 shadow-lg border-[${COLOR_PRIMARY}]/20`}>
          {" "}
          {/* Reduced padding */}
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "timeline" | "calendar")
            }
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 border-b pb-3 sm:pb-4">
              {/* H1 Title: Smaller on mobile (text-2xl) */}
              <h1
                className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-0"
                style={{ color: COLOR_PRIMARY }}
              >
                Task Management Hub
              </h1>
              {/* Tabs List: Full width on mobile, responsive width */}
              <TabsList
                className={`grid w-full sm:w-[320px] grid-cols-2 bg-gray-100`}
                style={{ borderColor: COLOR_PRIMARY }}
              >
                <TabsTrigger
                  value="timeline"
                  className="gap-1 sm:gap-2 data-[state=active]:text-white data-[state=active]:shadow-md transition-all text-xs sm:text-sm text-gray-600" // Smaller text/gap
                  style={
                    activeTab === "timeline"
                      ? { backgroundColor: COLOR_PRIMARY }
                      : {}
                  }
                >
                  <ListChecks
                    className={`h-3 w-3 sm:h-4 sm:w-4 ${
                      // Smaller icon
                      activeTab === "timeline"
                        ? COLOR_ACCENT_ICON
                        : "text-gray-600"
                    }`}
                  />{" "}
                  Assigned Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="gap-1 sm:gap-2 data-[state=active]:text-white data-[state=active]:shadow-md transition-all text-xs sm:text-sm text-gray-600" // Smaller text/gap
                  style={
                    activeTab === "calendar"
                      ? { backgroundColor: COLOR_PRIMARY }
                      : {}
                  }
                >
                  <CalendarDays
                    className={`h-3 w-3 sm:h-4 sm:w-4 ${
                      // Smaller icon
                      activeTab === "calendar"
                        ? COLOR_ACCENT_ICON
                        : "text-gray-600"
                    }`}
                  />{" "}
                  Completed Calendar
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="timeline" className="m-0">
              <TaskTimelineView role={role} />
            </TabsContent>
            <TabsContent value="calendar" className="m-0">
              <CompletedCalendarView />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
}
