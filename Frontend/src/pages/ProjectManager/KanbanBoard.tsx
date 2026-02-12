import React, { useState, useEffect } from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "@hello-pangea/dnd";
import {
    Plus,
    MoreHorizontal,
    GripVertical,
    Clock,
    User2,
    Settings2,
    Trash2,
    CheckCircle2,
    X,
    ClipboardList,
    Pencil,
    Loader2,
    Building2,
    Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "@/components/Layout";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { createPortal } from "react-dom";

const STATIC_BOARD_UI = {
    tasks: {},
    columns: {
        backlog: { id: "backlog", title: "Backlog", taskIds: [] },
        progress: { id: "progress", title: "In Progress", taskIds: [] },
        review: { id: "review", title: "Review", taskIds: [] },
        done: { id: "done", title: "Done", taskIds: [] },
    },
    columnOrder: ["backlog", "progress", "review", "done"],
};

/* ---------------- TRANSFORM BACKEND → UI ---------------- */
function transformBoard(board: any) {
    const tasks: any = {};
    const columns: any = {};
    const columnOrder: string[] = [];

    board.columns.forEach((col: any) => {
        columnOrder.push(col.id);
        columns[col.id] = {
            id: col.id,
            title: col.title,
            taskIds: col.issues.map((i: any) => i.id),
        };

        col.issues.forEach((issue: any) => {
            tasks[issue.id] = {
                id: issue.id,
                content: issue.title,
                priority: issue.priority,
                assignee: issue.assigneeName,
                time: issue.estimate,
            };
        });
    });

    return { tasks, columns, columnOrder };
}

const api = import.meta.env.VITE_API_BASE_URL;

const DragPortal = ({ children }: { children: React.ReactNode }) => {
    return createPortal(children, document.body);
};

/* ================= COMPONENT ================= */
export default function KanbanBoard() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [boards, setBoards] = useState<any[]>([]);
    const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
    const [userDepartment, setUserDepartment] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    const [targetColumnForNewTask, setTargetColumnForNewTask] =
        useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<any>(null);

    const [activeAddingSection, setActiveAddingSection] = useState(false);
    const [newSectionTitle, setNewSectionTitle] = useState("");
    const [isCreatingSection, setIsCreatingSection] = useState(false);

    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [tempColumnTitle, setTempColumnTitle] = useState("");

    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [isUpdatingTask, setIsUpdatingTask] = useState(false);
    const [isDeletingTask, setIsDeletingTask] = useState(false);

    const [createForm, setCreateForm] = useState({
        content: "",
        assignee: "",
        time: "",
        priority: "MEDIUM",
    });

    const refetchBoard = async () => {
        if (!selectedBoardId) return;

        const res = await fetch(`${api}/kanbanBoard/board/${selectedBoardId}`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        });

        const board = await res.json();

        if (board && board.columns) {
            setData(transformBoard(board));
        }
    };

    /* ---------------- LOAD BOARDS ---------------- */
    useEffect(() => {
        // ✅ show static board immediately
        setData(STATIC_BOARD_UI);
        setIsLoading(false);

        // Decode token to get user info
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUserRole(payload.role);
                // Department will be fetched from employee record via boards endpoint
            } catch (e) {
                console.error("Failed to decode token", e);
            }
        }

        // fetch all accessible boards
        (async () => {
            const res = await fetch(`${api}/kanbanBoard/boards`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            const fetchedBoards = await res.json();

            if (fetchedBoards && fetchedBoards.length > 0) {
                setBoards(fetchedBoards);
                // Select the first board by default
                setSelectedBoardId(fetchedBoards[0].id);
                setData(transformBoard(fetchedBoards[0]));

                // Extract department from the first board if it's a department board
                if (fetchedBoards[0].department) {
                    setUserDepartment(fetchedBoards[0].department);
                }
            }
        })();
    }, []);

    /* ---------------- RELOAD BOARD WHEN SELECTION CHANGES ---------------- */
    useEffect(() => {
        if (!selectedBoardId) return;

        // 1. Optimistic load from local cache for instant feedback
        const cachedBoard = boards.find(b => b.id === selectedBoardId);
        if (cachedBoard) {
            setData(transformBoard(cachedBoard));
        } else {
            // If not in cache, show loading immediately
            setIsLoading(true);
        }

        // 2. ALWAYS fetch fresh data from server to ensure synchronization
        // This fixes the issue where new tasks created on other boards don't appear when switching back
        (async () => {
            try {
                const res = await fetch(`${api}/kanbanBoard/board/${selectedBoardId}`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                });

                if (res.ok) {
                    const board = await res.json();
                    if (board && board.columns) {
                        setData(transformBoard(board));
                        // Update the cache so subsequent switches are also more accurate
                        setBoards(prev => {
                            const index = prev.findIndex(b => b.id === board.id);
                            if (index >= 0) {
                                const newBoards = [...prev];
                                newBoards[index] = board;
                                return newBoards;
                            }
                            return [...prev, board];
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to refresh board data", error);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [selectedBoardId]);


    /* ---------------- DRAG & DROP (NO LAG) ---------------- */
    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) return;

        const start = data.columns[source.droppableId];
        const finish = data.columns[destination.droppableId];

        // Moving within the same column
        if (start.id === finish.id) {
            const newTaskIds = Array.from(start.taskIds);
            newTaskIds.splice(source.index, 1);
            newTaskIds.splice(destination.index, 0, draggableId);

            const newColumn = {
                ...start,
                taskIds: newTaskIds,
            };

            setData({
                ...data,
                columns: {
                    ...data.columns,
                    [newColumn.id]: newColumn,
                },
            });
        } else {
            // Moving to a different column
            const startTaskIds = Array.from(start.taskIds);
            startTaskIds.splice(source.index, 1);

            const finishTaskIds = Array.from(finish.taskIds);
            finishTaskIds.splice(destination.index, 0, draggableId);

            setData({
                ...data,
                columns: {
                    ...data.columns,
                    [start.id]: { ...start, taskIds: startTaskIds },
                    [finish.id]: { ...finish, taskIds: finishTaskIds },
                },
            });
        }

        // ✅ Backend sync ONLY if real DB id
        if (!draggableId.startsWith("temp-")) {
            fetch(`${api}/kanbanBoard/issue/move`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    issueId: draggableId,
                    columnId: destination.droppableId,
                }),
            });
        }
    };


    /* ---------------- ADD SECTION ---------------- */
    const addSection = async () => {
        if (!newSectionTitle.trim() || !selectedBoardId) return;

        setIsCreatingSection(true);
        try {
            await fetch(`${api}/kanbanBoard/column`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    title: newSectionTitle,
                    boardId: selectedBoardId
                }),
            });

            setActiveAddingSection(false);
            setNewSectionTitle("");

            // smooth refresh
            await refetchBoard();
        } finally {
            setIsCreatingSection(false);
        }
    };


    /* ---------------- RENAME SECTION ---------------- */
    const handleRenameSection = async (columnId: string) => {
        await fetch(`${api}/kanbanBoard/column/${columnId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ title: tempColumnTitle }),
        });

        setEditingColumnId(null);
        refetchBoard();
    };


    /* ---------------- DELETE SECTION ---------------- */
    const deleteSection = async (columnId: string) => {
        await fetch(`${api}/kanbanBoard/column/${columnId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        });

        // 🔥 Optimistic UI update
        setData((prev: any) => {
            const newColumns = { ...prev.columns };
            const newColumnOrder = prev.columnOrder.filter(
                (id: string) => id !== columnId
            );

            // remove issues inside the column
            const issueIds = newColumns[columnId]?.taskIds || [];
            delete newColumns[columnId];

            const newTasks = { ...prev.tasks };
            issueIds.forEach((id: string) => delete newTasks[id]);

            return {
                ...prev,
                columns: newColumns,
                columnOrder: newColumnOrder,
                tasks: newTasks,
            };
        });
    };


    /* ---------------- ADD ISSUE ---------------- */
    const handleConfirmAddTask = async () => {
        if (!createForm.content || !targetColumnForNewTask) return;

        setIsCreatingTask(true);
        try {
            await fetch(`${api}/kanbanBoard/issue`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    content: createForm.content,
                    priority: createForm.priority,
                    time: createForm.time,
                    assignee: createForm.assignee,
                    columnId: targetColumnForNewTask,
                }),
            });

            setTargetColumnForNewTask(null);
            setCreateForm({ content: "", assignee: "", time: "", priority: "MEDIUM" });
            await refetchBoard();
        } finally {
            setIsCreatingTask(false);
        }
    };

    /* ---------------- UPDATE ISSUE ---------------- */
    const handleUpdateTask = async () => {
        if (!editingTask) return;

        setIsUpdatingTask(true);
        try {
            await fetch(`${api}/kanbanBoard/issue/${editingTask.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    content: editingTask.content,
                    priority: editingTask.priority,
                    time: editingTask.time,
                    assignee: editingTask.assignee,
                }),
            });

            // 🔥 Optimistic UI update
            setData((prev: any) => ({
                ...prev,
                tasks: {
                    ...prev.tasks,
                    [editingTask.id]: {
                        ...prev.tasks[editingTask.id],
                        content: editingTask.content,
                        priority: editingTask.priority,
                        time: editingTask.time,
                        assignee: editingTask.assignee,
                    },
                },
            }));

            setEditingTask(null);
        } finally {
            setIsUpdatingTask(false);
        }
    };

    /* ---------------- DELETE ISSUE ---------------- */
    const deleteTask = async (id: string) => {
        setIsDeletingTask(true);
        try {
            await fetch(`${api}/kanbanBoard/issue/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            // 🔥 Optimistic UI update
            setData((prev: any) => {
                const newTasks = { ...prev.tasks };
                delete newTasks[id];

                const newColumns = { ...prev.columns };
                Object.keys(newColumns).forEach((colId) => {
                    newColumns[colId].taskIds = newColumns[colId].taskIds.filter(
                        (taskId: string) => taskId !== id
                    );
                });

                return {
                    ...prev,
                    tasks: newTasks,
                    columns: newColumns,
                };
            });

            setEditingTask(null);
        } finally {
            setIsDeletingTask(false);
        }
    };


    if (isLoading) return <KanbanSkeleton />;

    const selectedBoard = boards.find(b => b.id === selectedBoardId);

    return (
        <Layout>
            <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-hidden">
                {/* MODERN HEADER */}
                <div className="flex-shrink-0 px-8 pt-6 pb-5 border-b border-slate-200/60 backdrop-blur-sm bg-white/80 z-10 shadow-sm">
                    <div className="flex items-center justify-between">
                        {/* Left Section - Title & Info */}
                        <div className="flex items-center gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                                        Kanban Board
                                    </h1>
                                    {userRole === "MANAGER" && userDepartment && (
                                        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-none px-3 py-1 text-xs font-semibold flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5" />
                                            {userDepartment} Department
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        {Object.keys(data.tasks).length} active tasks
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-medium">{data.columnOrder.length} columns</span>
                                </div>
                            </div>

                            {/* Board Selector Dropdown */}
                            {boards.length > 1 && (
                                <div className="ml-4 pl-6 border-l border-slate-200">
                                    <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Switch Board</Label>
                                    <select
                                        value={selectedBoardId || ""}
                                        onChange={(e) => setSelectedBoardId(e.target.value)}
                                        className="h-9 px-3 pr-8 rounded-lg bg-white border border-slate-200 font-medium text-slate-700 text-sm outline-none hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all min-w-[220px] cursor-pointer"
                                    >
                                        {boards.map((board) => (
                                            <option key={board.id} value={board.id}>
                                                {board.department ? `📁 ${board.department} Department` : `⭐ ${board.name}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Right Section - Actions */}
                        <div className="flex items-center gap-3">
                            {activeAddingSection ? (
                                <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                                    <Input
                                        autoFocus
                                        placeholder="Column name..."
                                        className="w-56 h-10 rounded-lg bg-white border-slate-200 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        value={newSectionTitle}
                                        onChange={(e) => setNewSectionTitle(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !isCreatingSection && addSection()}
                                        disabled={isCreatingSection}
                                    />
                                    <Button
                                        onClick={addSection}
                                        disabled={isCreatingSection}
                                        className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg h-10 px-5 font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                                    >
                                        {isCreatingSection ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setActiveAddingSection(false)}
                                        className="rounded-lg h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                        disabled={isCreatingSection}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => setActiveAddingSection(true)}
                                    variant="outline"
                                    className="rounded-lg font-semibold border-2 border-dashed border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50/50 h-10 px-5 transition-all"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Column
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* SCROLLABLE BOARD */}
                <div className="flex-1 overflow-x-auto p-8 scrollbar-hide flex items-start gap-5">
                    <DragDropContext onDragEnd={onDragEnd}>
                        {data.columnOrder.map((columnId: any) => {
                            const column = data.columns[columnId];
                            const tasks = column.taskIds.map((taskId: any) => data.tasks[taskId]);

                            return (
                                <div key={column.id} className="w-[340px] flex-shrink-0 flex flex-col max-h-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        {editingColumnId === column.id ? (
                                            <Input
                                                autoFocus
                                                className="h-8 text-sm font-semibold bg-white border-indigo-200 focus:border-indigo-500"
                                                value={tempColumnTitle}
                                                onChange={(e) => setTempColumnTitle(e.target.value)}
                                                onBlur={() => handleRenameSection(column.id)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleRenameSection(column.id)}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2.5">
                                                <h2 className="font-semibold text-slate-700 text-sm">{column.title}</h2>
                                                <Badge className="bg-slate-100 text-slate-600 rounded-full h-5 min-w-[22px] border-none text-xs font-medium">{tasks.length}</Badge>
                                            </div>
                                        )}

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-lg border-slate-200 shadow-lg p-1 bg-white">
                                                <DropdownMenuItem onClick={() => { setEditingColumnId(column.id); setTempColumnTitle(column.title); }} className="rounded-md font-medium text-sm flex gap-2 cursor-pointer"><Pencil className="h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => deleteSection(column.id)} className="rounded-md font-medium text-sm text-red-600 flex gap-2 cursor-pointer hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <Droppable droppableId={column.id}>
                                        {(provided, snapshot) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`flex-1 overflow-y-auto scrollbar-hide space-y-2.5 min-h-[100px] px-1 transition-colors rounded-lg ${snapshot.isDraggingOver ? 'bg-indigo-50/50 ring-2 ring-indigo-300 ring-inset' : ''}`}
                                            >
                                                {tasks.map((task: any, index: number) => (
                                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                                        {(provided, snapshot) => {
                                                            const card = (
                                                                <Card
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    style={{
                                                                        ...provided.draggableProps.style,
                                                                        zIndex: snapshot.isDragging ? 9999 : 'auto',
                                                                        cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                                                                    }}
                                                                    className={`p-4 border border-slate-200/60 shadow-sm hover:shadow-lg transition-shadow duration-200 group relative bg-white rounded-xl ${snapshot.isDragging
                                                                        ? "shadow-2xl ring-4 ring-indigo-400/60 opacity-95"
                                                                        : ""
                                                                        }`}
                                                                >
                                                                    {/* 👇 KEEP YOUR EXISTING CONTENT HERE EXACTLY SAME */}
                                                                    <div className="flex justify-between items-start mb-2.5">
                                                                        <Badge className={`text-xs font-medium px-2 py-0.5 ${task.priority === 'HIGH'
                                                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                                                            : task.priority === 'MEDIUM'
                                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                            }`}>
                                                                            {task.priority}
                                                                        </Badge>
                                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 hover:bg-slate-100 rounded-lg"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setEditingTask(task);
                                                                                }}
                                                                            >
                                                                                <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                                                                            </Button>
                                                                            <GripVertical className="h-4 w-4 text-slate-400 mt-1 group-hover:text-indigo-500 transition-colors" />
                                                                        </div>
                                                                    </div>

                                                                    <p className="font-medium text-slate-800 text-sm mb-3 leading-relaxed">
                                                                        {task.content}
                                                                    </p>

                                                                    <div className="flex items-center justify-between text-xs">
                                                                        {task.assignee && (
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 border border-indigo-200 flex items-center justify-center">
                                                                                    <User2 className="h-3 w-3 text-indigo-600" />
                                                                                </div>
                                                                                <span className="text-slate-600 font-medium">
                                                                                    {task.assignee}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {task.time && (
                                                                            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                                                                                <Clock className="h-3 w-3" />
                                                                                <span className="font-medium">{task.time}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </Card>
                                                            );

                                                            return snapshot.isDragging
                                                                ? <DragPortal>{card}</DragPortal>
                                                                : card;
                                                        }}
                                                    </Draggable>

                                                ))}
                                                {provided.placeholder}
                                                <button onClick={() => setTargetColumnForNewTask(column.id)} className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:bg-white hover:text-indigo-600 hover:border-indigo-300 transition-all font-medium text-sm flex items-center justify-center gap-2 group">
                                                    <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                                                    Add Task
                                                </button>
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </DragDropContext>
                </div>

                {/* --- NEW ISSUE FORM MODAL --- */}
                <Dialog open={!!targetColumnForNewTask} onOpenChange={() => !isCreatingTask && setTargetColumnForNewTask(null)}>
                    <DialogContent className="max-w-lg bg-white rounded-2xl p-8 border-none shadow-2xl">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-12 w-12 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl flex items-center justify-center">
                                    <Sparkles className="h-6 w-6 text-indigo-600" />
                                </div>
                                <DialogTitle className="text-2xl font-bold text-slate-900">Create New Task</DialogTitle>
                            </div>
                        </DialogHeader>
                        <div className="space-y-5 py-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700">Task Name</Label>
                                <Input
                                    autoFocus
                                    placeholder="e.g., Design new landing page"
                                    className="h-11 rounded-lg bg-slate-50 border-slate-200 text-base font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    value={createForm.content}
                                    onChange={e => setCreateForm({ ...createForm, content: e.target.value })}
                                    disabled={isCreatingTask}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700">Priority</Label>
                                    <select
                                        className="w-full h-11 rounded-lg bg-slate-50 border border-slate-200 px-3 font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        value={createForm.priority}
                                        onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
                                        disabled={isCreatingTask}
                                    >
                                        <option value="HIGH">🔴 High</option>
                                        <option value="MEDIUM">🟡 Medium</option>
                                        <option value="LOW">🟢 Low</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700">Time Estimate</Label>
                                    <Input
                                        placeholder="e.g., 4h"
                                        className="h-11 rounded-lg bg-slate-50 border-slate-200 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        value={createForm.time}
                                        onChange={e => setCreateForm({ ...createForm, time: e.target.value })}
                                        disabled={isCreatingTask}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700">Assign To</Label>
                                <Input
                                    placeholder="Team member name..."
                                    className="h-11 rounded-lg bg-slate-50 border-slate-200 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    value={createForm.assignee}
                                    onChange={e => setCreateForm({ ...createForm, assignee: e.target.value })}
                                    disabled={isCreatingTask}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={handleConfirmAddTask}
                                disabled={isCreatingTask || !createForm.content}
                                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {isCreatingTask ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating Task...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Task
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* TASK EDITOR DIALOG */}
                <Dialog open={!!editingTask} onOpenChange={() => !isUpdatingTask && !isDeletingTask && setEditingTask(null)}>
                    <DialogContent className="max-w-lg bg-white rounded-2xl p-8 border-none shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-slate-900">Edit Task</DialogTitle>
                        </DialogHeader>
                        {editingTask && (
                            <div className="space-y-5 py-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700">Task Name</Label>
                                    <Input
                                        value={editingTask.content}
                                        onChange={(e) => setEditingTask({ ...editingTask, content: e.target.value })}
                                        className="h-11 rounded-lg bg-slate-50 border-slate-200 text-base font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        disabled={isUpdatingTask || isDeletingTask}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-slate-700">Priority</Label>
                                        <select
                                            value={editingTask.priority}
                                            onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                                            className="w-full h-11 rounded-lg bg-slate-50 border border-slate-200 px-3 font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                            disabled={isUpdatingTask || isDeletingTask}
                                        >
                                            <option value="HIGH">🔴 High</option>
                                            <option value="MEDIUM">🟡 Medium</option>
                                            <option value="LOW">🟢 Low</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-slate-700">Assignee</Label>
                                        <Input
                                            value={editingTask.assignee}
                                            onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })}
                                            className="h-11 rounded-lg bg-slate-50 border-slate-200 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                            disabled={isUpdatingTask || isDeletingTask}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700">Time Estimate</Label>
                                    <Input
                                        value={editingTask.time}
                                        onChange={(e) => setEditingTask({ ...editingTask, time: e.target.value })}
                                        className="h-11 rounded-lg bg-slate-50 border-slate-200 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        disabled={isUpdatingTask || isDeletingTask}
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter className="flex gap-3 sm:justify-between items-center pt-2">
                            <Button
                                variant="outline"
                                onClick={() => deleteTask(editingTask.id)}
                                disabled={isUpdatingTask || isDeletingTask}
                                className="rounded-lg border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold px-5"
                            >
                                {isDeletingTask ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleUpdateTask}
                                disabled={isUpdatingTask || isDeletingTask}
                                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg font-semibold px-8 h-11 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {isUpdatingTask ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </Layout>
    );
}

function KanbanSkeleton() {
    return (
        <Layout>
            <div className="p-10 h-screen flex flex-col gap-10 bg-slate-50">
                <Skeleton className="h-12 w-1/3 rounded-2xl" />
                <div className="flex gap-6 overflow-hidden">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-80 flex-shrink-0 space-y-4">
                            <Skeleton className="h-6 w-24 rounded-full" />
                            <Skeleton className="h-[400px] w-full rounded-[2.5rem]" />
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
}