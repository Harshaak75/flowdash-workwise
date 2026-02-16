
import { useState, useEffect } from "react";
import { Bell, Check, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/pages/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Notification {
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    resourceId: string | null;
    createdAt: string;
    type: string;
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/notifications`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [user]);

    const unreadNotifications = notifications.filter((n) => !n.isRead);
    const unreadCount = unreadNotifications.length;

    const handleRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );

            await fetch(`${import.meta.env.VITE_API_BASE_URL}/notifications/${id}/read`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            // Removed navigation as per request
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            setNotifications((prev) => prev.map(n => ({ ...n, isRead: true })));
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/notifications/read-all`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
        } catch (err) { console.error(err); }
    }

    const NotificationItem = ({ n }: { n: Notification }) => (
        <div
            className={cn(
                "group p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200 relative border-b last:border-0",
                !n.isRead ? "bg-blue-50/40" : ""
            )}
            onClick={() => handleRead(n.id)}
        >
            <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-1">
                    <p className={cn("text-sm leading-snug", !n.isRead ? "font-semibold text-gray-900" : "text-gray-700 font-medium")}>
                        {n.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {n.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                        {new Date(n.createdAt).toLocaleDateString()} • {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                {!n.isRead && (
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-600 shrink-0 ring-2 ring-blue-100" />
                )}
            </div>
        </div>
    );

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-900 hover:bg-[#2A00B7]/10 transition-colors">
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white animate-pulse" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 mr-4 shadow-xl border-gray-200" align="end">

                <Tabs defaultValue="unread" className="w-full">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80 backdrop-blur-sm">
                        <h4 className="font-semibold text-sm text-gray-800">Notifications</h4>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                            >
                                <Check className="h-3 w-3" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
                        <TabsTrigger
                            value="unread"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 px-4 py-2 text-xs font-medium bg-transparent"
                        >
                            Unread ({unreadCount})
                        </TabsTrigger>
                        <TabsTrigger
                            value="all"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 px-4 py-2 text-xs font-medium bg-transparent"
                        >
                            All Notifications
                        </TabsTrigger>
                    </TabsList>

                    <ScrollArea className="h-[350px]">
                        <TabsContent value="unread" className="m-0">
                            {unreadNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                    <MailOpen className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-sm">No unread notifications</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {unreadNotifications.map((n) => (
                                        <NotificationItem key={n.id} n={n} />
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="all" className="m-0">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                    <Bell className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-sm">No notifications yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {notifications.map((n) => (
                                        <NotificationItem key={n.id} n={n} />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
}
