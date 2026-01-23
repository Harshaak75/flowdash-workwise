"use client";

import { useEffect, useState, ReactNode, useRef } from "react";
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
  ChevronRight,
  Filter,
  Download,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createPortal } from "react-dom";

// ... (Interface definitions remain exactly as provided)
interface Comment {
  id: string;
  taskId: string;
  content: string;
  authorId: string;
  author: { id: string; email: string; role: string; };
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

const COLOR_PRIMARY = "#0000cc";
const COLOR_DANGER = "#dc2626";
const COLOR_SUCCESS = "#059669";

type PriorityFilter = Task["priority"] | "all";

// --- Utility Functions ---
const getStatusStyles = (status: Task["status"]) => {
  switch (status) {
    case "WORKING": return "bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20";
    case "DONE": return "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20";
    case "TODO": return "bg-slate-50 text-slate-600 border-slate-200 ring-slate-500/10";
    case "STUCK": return "bg-red-50 text-red-700 border-red-200 ring-red-500/20";
    default: return "bg-gray-50 text-gray-600 border-gray-200";
  }
};

const StatusIcon = ({ status }: { status: Task["status"] }) => {
  switch (status) {
    case "WORKING": return <RotateCw className="h-4 w-4 animate-spin-slow text-blue-600" />;
    case "DONE": return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "TODO": return <Hourglass className="h-4 w-4 text-slate-400" />;
    case "STUCK": return <Activity className="h-4 w-4 text-red-600" />;
    default: return <FileText className="h-4 w-4 text-gray-400" />;
  }
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- Task Timeline View ---
const TaskTimelineView = ({ role }: { role: any }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTaskForUpload, setSelectedTaskForUpload] = useState<Task | null>(null);
  const [tempFile, setTempFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pagination Logic
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 8;

  const openUploadModal = (task: Task) => {
    setSelectedTaskForUpload(task);
    setIsModalOpen(true);
    setTempFile(null);
  };

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      console.log("the current role: ", role)
      const res = role === "OPERATOR"
        ? await axios.get(`${API_BASE_URL}/tasks/EmployeeTasks`)
        : await axios.get(`${API_BASE_URL}/projectManager/ManagerTasks`);

      const fetchedTasks = res.data.tasks || res.data;
      setTasks(fetchedTasks.filter((task: any) => task.status !== "DONE"));
    } catch (err) {
      toast({ title: "Error", description: "Could not sync tasks.", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  // ... (handleStatusChange, handleFileUpload, fetchCommentsForTask, sendComment logic remains UNTOUCHED)
  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    try {
      await axios.patch(`${API_BASE_URL}/tasks/${taskId}/status`, { status: newStatus });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t));
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast({ title: "Conflict", description: "Please pause other tasks first.", variant: "destructive" });
      }
    }
  };

  const handleFileUpload = async (taskId: string, file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_BASE_URL}/tasks/${taskId}/upload`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, employeeFiles: t.employeeFiles ? [...t.employeeFiles, res.data.fileUrl] : [res.data.fileUrl] } : t));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchCommentsForTask = async (taskId: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/comments/${taskId}`);
      const comments: Comment[] = res.data.comments || res.data;
      const task = tasks.find((t) => t.id === taskId);
      if (task) setSelectedTask({ ...task, comments });
    } catch (err) { console.error(err); }
  };

  const sendComment = async () => {
    if (!selectedTask || !commentText.trim()) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/comments/${selectedTask.id}`, { content: commentText });
      const newComment: Comment = { ...res.data };
      setSelectedTask((prev) => prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : prev);
      setCommentText("");
    } catch (err) { console.error(err); }
  };

  const filteredTasks = tasks.filter((task) => priorityFilter === "all" || task.priority === priorityFilter);
  const orderedTasks = filteredTasks.sort((a, b) => {
    if (a.priority === "HIGH" && b.priority !== "HIGH") return -1;
    return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
  });

  // Pagination Calc
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = orderedTasks.slice(indexOfFirstTask, indexOfLastTask);
  const totalPages = Math.ceil(orderedTasks.length / tasksPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 px-1">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Active Workstream <Badge variant="outline" className="rounded-full bg-slate-100 text-slate-600 border-none px-2">{orderedTasks.length}</Badge>
          </h2>
          <p className="text-sm text-slate-500">Manage your high-priority assignments and deliverables.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v as PriorityFilter); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white border-slate-200 rounded-lg shadow-sm">
              <SelectValue placeholder="Priority Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="HIGH">High Priority</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden lg:grid grid-cols-[1fr_2.5fr_2fr_1.8fr_1fr_1.5fr_0.8fr] gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-2">Status</div>
          <div>Task Information</div>
          <div>Timeline & Priority</div>
          <div>Progress Notes</div>
          <div className="text-center">Assets</div>
          <div className="text-center">Worklogs</div>
          <div className="text-center">Chat</div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium text-slate-400">Syncing with workspace...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {currentTasks.map((task) => (
              <div key={task.id} className="group lg:grid lg:grid-cols-[1fr_2.5fr_2fr_1.8fr_1fr_1.5fr_0.8fr] gap-4 px-4 py-4 sm:px-6 items-center hover:bg-slate-50/50 transition-all duration-200">

                {/* Status Column */}
                <div className="flex lg:flex-row flex-row-reverse justify-between lg:justify-start items-center gap-3 mb-3 lg:mb-0">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm ring-1 ring-inset ${getStatusStyles(task.status)}`}>
                    <StatusIcon status={task.status} />
                    <span className="lg:inline uppercase tracking-tight">{task.status}</span>
                  </div>
                  <div className="lg:hidden block">
                    <Badge className={`${task.priority === 'HIGH' ? 'bg-red-600' : task.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-[#0000cc]'} text-[10px]`}>{task.priority}</Badge>
                  </div>
                </div>

                {/* Info Column */}
                <div className="mb-2 lg:mb-0">
                  <h4 className="font-bold text-slate-900 group-hover:text-[#0000cc] transition-colors leading-tight">{task.title}</h4>
                  <div className="lg:hidden flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(task.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Priority & Deadline */}
                <div className="hidden lg:flex flex-col gap-1.5">
                  <Badge variant="outline" className={`w-fit text-[10px] h-5 font-bold uppercase border-none ring-1 ring-inset ${task.priority === 'HIGH' ? 'bg-red-50 text-red-600 ring-red-500/30' : 'bg-slate-100 text-slate-600 ring-slate-500/20'}`}>
                    {task.priority} Priority
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className={new Date(task.dueDate || 0) < new Date() ? 'text-red-600 font-bold' : ''}>
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No deadline'}
                    </span>
                  </div>
                </div>

                {/* Status Update (Buttonized) */}
                <div className="mb-4 lg:mb-0" onClick={(e) => e.stopPropagation()}>
                  <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v as Task["status"])}>
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 rounded-lg hover:border-indigo-300 text-xs font-medium focus:ring-indigo-500/20 shadow-sm">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">Mark Todo</SelectItem>
                      <SelectItem value="WORKING">Start Work</SelectItem>
                      <SelectItem value="STUCK">Report Stuck</SelectItem>
                      <SelectItem value="DONE">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* File Assets */}
                <div className="flex justify-center gap-4 py-2 lg:py-0 border-t border-slate-50 lg:border-none">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-100 group/btn" onClick={() => task.fileUrl_manager && window.open(task.fileUrl_manager)}>
                          <Download className={`h-4 w-4 ${task.fileUrl_manager ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>PM Resource</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-100 group/btn" onClick={() => openUploadModal(task)}>
                          <Upload className={`h-4 w-4 ${task.employeeFiles?.length ? 'text-emerald-600' : 'text-slate-300'}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Deliverables</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Worklogs */}
                <div className="hidden lg:flex flex-col items-center">
                  <div className="text-sm font-black text-slate-800 tracking-tight">{task.assignedHours || "-"}h</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Allocated</div>
                </div>

                {/* Chat Column */}
                <div className="flex justify-center">
                  <button onClick={() => { setSelectedTask(task); fetchCommentsForTask(task.id); }} className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white transition-all duration-300 shadow-inner group/chat">
                    <MessageSquare className="h-5 w-5" />
                    {task.comments && task.comments.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center">
                        {task.comments.length}
                      </span>
                    )}
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* Industry Standard Pagination */}
        {!loading && totalPages > 1 && (
          <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-t border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all"><ChevronRight className="h-4 w-4 rotate-180" /></button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modern Centered Upload Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-[10000] bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-[#0000cc] p-8 text-white text-center">
              <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-black">Submit Deliverable</h3>
              <p className="text-indigo-100 text-sm mt-1 opacity-80">{selectedTaskForUpload?.title}</p>
            </div>

            <div className="p-8">
              <label className={`relative group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed rounded-2xl py-12 transition-all ${tempFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'}`}>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setTempFile(e.target.files?.[0] || null)} />
                {tempFile ? (
                  <div className="text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-800 max-w-[200px] truncate">{tempFile.name}</p>
                    <p className="text-xs text-slate-400">{(tempFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-black text-slate-700">Drag & Drop</p>
                    <p className="text-xs text-slate-400">or click to browse local files</p>
                  </div>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setIsModalOpen(false)} className="py-3.5 font-bold text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                <button disabled={!tempFile} onClick={async () => { if (tempFile && selectedTaskForUpload) { await handleFileUpload(selectedTaskForUpload.id, tempFile); setIsModalOpen(false); } }} className="py-3.5 font-bold bg-[#0000cc] text-white rounded-2xl shadow-xl shadow-blue-200 disabled:opacity-40 active:scale-95 transition-all">Confirm Submission</button>
              </div>
            </div>
          </div>
        </div>,
        document.getElementById("modal-root") || document.body
      )}

      {/* Redesigned Comment Modal */}
      {/* Floating WhatsApp-style Chat Box */}
      {selectedTask && (
        <div className="fixed bottom-6 right-6 z-[9999] w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 animate-in slide-in-from-right-8 duration-300 overflow-hidden">
          {/* Header */}
          <div className="bg-[#0000cc] p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                {selectedTask.title.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-sm truncate w-[200px] leading-tight">{selectedTask.title}</h3>
                <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">Online</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="h-8 w-8 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white pattern-dots">
            {/* Loading State - WhatsApp Style */}
            {!selectedTask.comments ? (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-3 w-2/3 animate-pulse">
                  <div className="h-2 bg-slate-200 rounded w-full mb-2" />
                  <div className="h-2 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="bg-[#dcf8c6] rounded-lg p-3 w-2/3 ml-auto animate-pulse">
                  <div className="h-2 bg-emerald-200 rounded w-full mb-2" />
                  <div className="h-2 bg-emerald-200 rounded w-3/4" />
                </div>
              </div>
            ) : selectedTask.comments.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-xs text-slate-500 bg-white/50 inline-block px-3 py-1 rounded-full">No messages yet</p>
              </div>
            ) : (
              selectedTask.comments.map((c) => {
                const isMe = c.author.role === localStorage.getItem("userRole");
                return (
                  <div key={c.id} className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                    <div className={`p-3 rounded-xl text-sm shadow-sm relative ${isMe ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}`}>
                      {!isMe && <p className="text-[10px] font-bold text-indigo-600 mb-1">{c.author.email.split('@')[0]}</p>}
                      {c.content}
                      <p className="text-[9px] text-slate-400 text-right mt-1">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-[#f0f2f5] flex gap-2 items-center">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendComment()}
              placeholder="Type a message"
              className="flex-1 bg-white border-none rounded-full px-4 py-2 text-sm focus:ring-0 shadow-sm"
            />
            <button
              onClick={sendComment}
              disabled={!commentText.trim()}
              className="h-10 w-10 bg-[#0000cc] text-white rounded-full flex items-center justify-center hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Layout Component ---
export default function EmployeeTaskTimeline() {
  const [activeTab, setActiveTab] = useState<"timeline" | "calendar">("timeline");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) {
      setRole(storedRole);
    }
  }, []);

  if (!role) {
    return <div>Loading...</div>; // or skeleton
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/30 p-4 sm:p-10 space-y-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Management <span className="text-[#0000cc]">Hub</span></h1>
            <div className="flex items-center gap-2 text-slate-400 font-medium">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="text-xs uppercase tracking-[0.2em]">Operational Workspace v2.0</span>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "timeline" | "calendar")} className="w-full sm:w-auto">
            <TabsList className="bg-slate-200/50 p-1 rounded-2xl h-14">
              <TabsTrigger value="timeline" className="rounded-xl px-8 h-full data-[state=active]:bg-white data-[state=active]:text-[#0000cc] data-[state=active]:shadow-xl transition-all duration-300 font-bold text-slate-500 gap-2">
                <ListChecks className="h-4 w-4" /> Timeline
              </TabsTrigger>
              <TabsTrigger value="calendar" className="rounded-xl px-8 h-full data-[state=active]:bg-white data-[state=active]:text-[#0000cc] data-[state=active]:shadow-xl transition-all duration-300 font-bold text-slate-500 gap-2">
                <CalendarDays className="h-4 w-4" /> History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {activeTab === "timeline" ? <TaskTimelineView role={role} /> : <CompletedCalendarView />}
        </div>
      </div>
    </Layout>
  );
}

// Completed Calendar View Re-styled for UX
const CompletedCalendarView = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/tasks/EmployeeTasks`);
        // Filter for tasks with status DONE
        setTasks(res.data.tasks.filter((t: Task) => t.status === "DONE"));
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchTasks();
  }, []);

  const grouped = tasks.reduce((acc, t) => {
    const d = t.updatedAt.split("T")[0];
    acc[d] = acc[d] || [];
    acc[d].push(t);
    return acc;
  }, {} as any);

  const dates = Object.keys(grouped).sort().reverse();

  return (
    <>
      {loading ? (
        <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-slate-200 h-10 w-10" />
          <p className="text-sm font-medium text-slate-400">Retrieving records...</p>
        </div>
      ) : tasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dates.map(date => (
            <Card key={date} className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow animate-in fade-in duration-500">
              <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50 p-6">
                <CardTitle className="text-emerald-700 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {grouped[date].map((t: Task) => (
                  <div key={t.id} className="flex items-center gap-3 group">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 group-hover:scale-150 transition-transform" />
                    <span className="text-sm font-bold text-slate-700">{t.title}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* PROFESSIONAL EMPTY STATE */
        <div className="flex flex-col items-center justify-center py-24 text-center animate-in zoom-in duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-slate-100 rounded-full scale-150 blur-3xl opacity-50" />
            <div className="relative bg-white shadow-xl rounded-[2.5rem] p-10 border border-slate-50">
              <ListChecks className="h-16 w-16 text-slate-200" />
            </div>
          </div>
          <div className="space-y-2 max-w-sm px-4">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Clear History</h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              No completed tasks found in your work history. Your contributions will appear here once objectives are finalized.
            </p>
          </div>
        </div>
      )}
    </>
  );
};