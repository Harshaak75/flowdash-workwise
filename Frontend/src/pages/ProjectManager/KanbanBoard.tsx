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

/* ================= COMPONENT ================= */
export default function KanbanBoard() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [targetColumnForNewTask, setTargetColumnForNewTask] =
        useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<any>(null);

    const [activeAddingSection, setActiveAddingSection] = useState(false);
    const [newSectionTitle, setNewSectionTitle] = useState("");

    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [tempColumnTitle, setTempColumnTitle] = useState("");

    const [createForm, setCreateForm] = useState({
        content: "",
        assignee: "",
        time: "",
        priority: "MEDIUM",
    });

    const refetchBoard = async () => {
        const res = await fetch(`${api}/kanbanBoard/board`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        });

        const board = await res.json();

        if (board && board.columns) {
            setData(transformBoard(board));
        }
    };

    /* ---------------- LOAD BOARD ---------------- */
    useEffect(() => {
        // ✅ show static board immediately
        setData(STATIC_BOARD_UI);
        setIsLoading(false);

        // fetch real board
        (async () => {
            const res = await fetch(`${api}/kanbanBoard/board`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            const board = await res.json();

            if (board && board.columns) {
                setData(transformBoard(board));
            }
        })();
    }, []);


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

        const startTaskIds = Array.from(start.taskIds);
        startTaskIds.splice(source.index, 1);

        const finishTaskIds = Array.from(finish.taskIds);
        finishTaskIds.splice(destination.index, 0, draggableId);

        // ✅ Optimistic UI update (instant)
        setData({
            ...data,
            columns: {
                ...data.columns,
                [start.id]: { ...start, taskIds: startTaskIds },
                [finish.id]: { ...finish, taskIds: finishTaskIds },
            },
        });

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
        if (!newSectionTitle.trim()) return;

        await fetch(`${api}/kanbanBoard/column`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ title: newSectionTitle }),
        });

        setActiveAddingSection(false);
        setNewSectionTitle("");

        // smooth refresh
        refetchBoard();
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
        refetchBoard();
    };

    /* ---------------- UPDATE ISSUE ---------------- */
    const handleUpdateTask = async () => {
        if (!editingTask) return;

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
    };

    /* ---------------- DELETE ISSUE ---------------- */
    const deleteTask = async (id: string) => {
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
    };


    if (isLoading) return <KanbanSkeleton />;

    return (
        <Layout>
            <div className="h-screen flex flex-col bg-slate-50/30 overflow-hidden">
                {/* STATIC HEADER */}
                <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 z-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight tracking-tighter">Kanban <span className="text-[#0000cc]">Board</span></h1>
                        <div className="flex items-center gap-4 mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> All systems active</span>
                            <span>•</span>
                            <span>{Object.keys(data.tasks).length} issues</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeAddingSection ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                                <Input autoFocus placeholder="Section Name" className="w-48 h-10 rounded-xl bg-slate-50 border-none font-bold" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSection()} />
                                <Button onClick={addSection} className="bg-[#0000cc] hover:bg-[#0000cc]/60 rounded-xl h-10 px-6 font-bold uppercase text-[12px] tracking-widest">Create</Button>
                                <Button variant="ghost" onClick={() => setActiveAddingSection(false)} className="rounded-xl h-10 w-10 text-red-500 hover:bg-red-300"><X className="h-4 w-4" /></Button>
                            </div>
                        ) : (
                            <Button onClick={() => setActiveAddingSection(true)} variant="outline" className="rounded-xl font-bold border-dashed border-2 border-slate-200 text-[#0000cc] hover:bg-[#0000cc]/60 h-10">
                                <Plus className="h-4 w-4 mr-2" /> Add Section
                            </Button>
                        )}
                    </div>
                </div>
                {/* slate-50/80 */}

                {/* SCROLLABLE BOARD */}
                <div className="flex-1 overflow-x-auto p-8 scrollbar-hide flex items-start gap-6 bg-slate-50/20">
                    <DragDropContext onDragEnd={onDragEnd}>
                        {data.columnOrder.map((columnId: any) => {
                            const column = data.columns[columnId];
                            const tasks = column.taskIds.map((taskId: any) => data.tasks[taskId]);

                            return (
                                <div key={column.id} className="w-[320px] flex-shrink-0 flex flex-col max-h-full bg-white rounded-[2rem] p-3 border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-4 px-3 pt-2 group/header">
                                        {editingColumnId === column.id ? (
                                            <Input
                                                autoFocus
                                                className="h-7 text-[11px] font-black uppercase tracking-widest bg-white border-[#0000cc]/20"
                                                value={tempColumnTitle}
                                                onChange={(e) => setTempColumnTitle(e.target.value)}
                                                onBlur={() => handleRenameSection(column.id)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleRenameSection(column.id)}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 cursor-pointer">
                                                <h2 className="font-black text-slate-800 uppercase text-[11px] tracking-widest">{column.title}</h2>
                                                <Badge className="bg-slate-200 text-slate-600 rounded-full h-5 min-w-[20px] border-none text-[10px]">{tasks.length}</Badge>
                                            </div>
                                        )}

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-300 hover:text-slate-200 hover:bg-[#0000cc]/50 transition-colors"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl border-none shadow-2xl p-2 bg-white">
                                                <DropdownMenuItem onClick={() => { setEditingColumnId(column.id); setTempColumnTitle(column.title); }} className="rounded-lg font-bold text-xs flex gap-2 cursor-pointer"><Pencil className="h-3 w-3" /> Rename</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => deleteSection(column.id)} className="rounded-lg font-bold text-xs text-red-500 flex gap-2 cursor-pointer hover:bg-red-50"><Trash2 className="h-3 w-3" /> Delete Section</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <Droppable droppableId={column.id}>
                                        {(provided, snapshot) => (
                                            <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 overflow-y-auto scrollbar-hide space-y-3 min-h-[100px] p-1">
                                                {tasks.map((task: any, index: number) => (
                                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <Card ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`p-4 border-none shadow-sm hover:shadow-xl transition-all duration-300 group relative bg-slate-50/80 rounded-2xl ${snapshot.isDragging ? "shadow-2xl ring-2 ring-[#0000cc]/20 rotate-1 scale-105 z-50" : ""}`}>
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <Badge className={`text-[9px] font-black tracking-widest uppercase ${task.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-[#0000cc]'}`}>{task.priority}</Badge>
                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-slate-100" onClick={() => setEditingTask(task)}><Settings2 className="h-3 w-3 text-slate-400" /></Button>
                                                                        <GripVertical className="h-3 w-3 text-slate-200 mt-1.5" />
                                                                    </div>
                                                                </div>
                                                                <p className="font-bold text-slate-800 text-sm mb-4 leading-snug group-hover:text-[#0000cc] transition-colors">{task.content}</p>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center"><User2 className="h-3 w-3 text-[#0000cc]" /></div>
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{task.assignee}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-slate-400"><Clock className="h-3 w-3" /><span className="text-[10px] font-black">{task.time}</span></div>
                                                                </div>
                                                            </Card>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                                <button onClick={() => setTargetColumnForNewTask(column.id)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:bg-white hover:text-[#0000cc] hover:border-[#0000cc]/30 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                                    <Plus className="h-3 w-3" /> New Issue
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
                <Dialog open={!!targetColumnForNewTask} onOpenChange={() => setTargetColumnForNewTask(null)}>
                    <DialogContent className="max-w-md bg-white rounded-[2.5rem] p-10 border-none shadow-2xl animate-in fade-in zoom-in-95">
                        <DialogHeader>
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-[#0000cc] shadow-inner">
                                <ClipboardList className="h-8 w-8" />
                            </div>
                            <DialogTitle className="text-3xl font-bold text-slate-900 tracking-tighter">Initiate <span className="text-[#0000cc]">Task</span></DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Issue Name</Label>
                                <Input autoFocus placeholder="e.g. Design System Update" className="h-14 rounded-2xl bg-slate-50 border-none text-base font-bold" value={createForm.content} onChange={e => setCreateForm({ ...createForm, content: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Priority</Label>
                                    <select className="w-full h-14 rounded-2xl bg-slate-50 border-none px-4 font-bold text-slate-700 outline-none" value={createForm.priority} onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}>
                                        <option value="HIGH">Critical</option>
                                        <option value="MEDIUM">Standard</option>
                                        <option value="LOW">Minor</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Time (Estimate)</Label>
                                    <Input placeholder="e.g. 4h" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={createForm.time} onChange={e => setCreateForm({ ...createForm, time: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Assign To</Label>
                                <Input placeholder="Member name..." className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={createForm.assignee} onChange={e => setCreateForm({ ...createForm, assignee: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleConfirmAddTask} className="w-full h-16 bg-[#0000cc] rounded-[1.5rem] font-bold text-xs uppercase tracking-widest  transition-all hover:bg-[#0000cc]/80 active:scale-95">Confirm Assignment</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* TASK EDITOR DIALOG */}
                <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
                    <DialogContent className="max-w-md bg-white rounded-[2.5rem] p-10 border-none shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                        <DialogHeader><DialogTitle className="text-3xl font-bold text-slate-900 tracking-tighter">Issue <span className="text-[#0000cc]">Intelligence</span></DialogTitle></DialogHeader>
                        {editingTask && (
                            <div className="space-y-6 py-6">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Title</Label><Input value={editingTask.content} onChange={(e) => setEditingTask({ ...editingTask, content: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none text-base font-bold text-slate-800 focus-visible:ring-2 focus-visible:ring-[#0000cc]/20" /></div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Priority</Label>
                                        <select value={editingTask.priority} onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })} className="w-full h-12 rounded-xl bg-slate-50 border-none px-4 text-sm font-bold text-slate-700 outline-none">
                                            <option value="HIGH">Critical</option><option value="MEDIUM">Standard</option><option value="LOW">Minor</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Assignee</Label><Input value={editingTask.assignee} onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })} className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-700" /></div>
                                </div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Time Estimate</Label><Input value={editingTask.time} onChange={(e) => setEditingTask({ ...editingTask, time: e.target.value })} className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-700" /></div>
                            </div>
                        )}
                        <DialogFooter className="flex gap-3 sm:justify-between items-center border-t border-slate-50 pt-6">
                            <Button variant="ghost" onClick={() => deleteTask(editingTask.id)} className="rounded-xl text-red-500 hover:bg-red-500 hover:text-white font-bold text-xs uppercase tracking-widest"><Trash2 className="h-4 w-4" /> Terminate</Button>
                            <Button onClick={handleUpdateTask} className="bg-[#0000cc] rounded-2xl font-bold text-xs uppercase tracking-widest px-10 h-12 hover:bg-[#0000cc]/80 transition-all">Save Changes</Button>
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