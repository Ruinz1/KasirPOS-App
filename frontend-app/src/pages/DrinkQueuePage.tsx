import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Undo2, Coffee, Pencil, RefreshCw, GlassWater, Clock } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EditQueueOrderDialog } from "@/components/EditQueueOrderDialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

interface OrderItem {
    id: number;
    menu_item_id: number;
    quantity: number;
    price: number;
    note: string | null;
    is_takeaway?: boolean;
    is_addon?: boolean;
    menu_item: {
        id: number;
        name: string;
        price: number;
        category?: string;
    } | null;
    created_at?: string;
}

interface QueueOrder {
    id: number;
    customer_name: string;
    daily_number: number;
    total: number;
    queue_status: "pending" | "in_progress" | "completed" | "hold";
    drink_queue_status: "pending" | "completed" | "hold";
    notes: string | null;
    created_at: string;
    order_type?: "dine_in" | "takeaway";
    items: OrderItem[];
    user: { id: number; name: string };
    queue_completed_at: string | null;
    payment_status: "pending" | "paid";
    payment_method?: string;
    paid_amount?: number;
    second_paid_amount?: number;
    change_amount?: number;
    table?: { id: number; table_number: string; capacity: number } | null;
    hold_reason?: string | null;
}

const DRINK_CATEGORIES = ["minuman", "drink", "beverage", "drinks"];

const isFoodItem = (item: OrderItem) => !DRINK_CATEGORIES.includes((item.menu_item?.category || "").toLowerCase());
const isDrinkItem = (item: OrderItem) => DRINK_CATEGORIES.includes((item.menu_item?.category || "").toLowerCase());

/** True jika order ini adalah re-activated (sudah pernah selesai lalu ada tambahan) */
const isOrderReactivated = (order: QueueOrder) =>
    !!(order.queue_completed_at && order.queue_status !== "completed");

const getDisplayItems = (order: QueueOrder) => {
    const reactivated = isOrderReactivated(order);
    return reactivated
        ? order.items.filter(i => {
            if (!i.is_addon) return false;
            const cat = (i.menu_item?.category || "").toLowerCase();
            return ["makanan", "minuman"].includes(cat);
        })
        : [...order.items].sort((a, b) => a.id - b.id);
};

/** Item minuman original (bukan addon) untuk konteks re-order */
const getOriginalDrinkItems = (order: QueueOrder) =>
    order.items.filter(i => !i.is_addon && isDrinkItem(i)).sort((a, b) => a.id - b.id);

const shouldHideOrder = (order: QueueOrder): boolean => {
    const displayItems = getDisplayItems(order);
    const hasFoodSection = displayItems.filter(isFoodItem).length > 0;
    const hasDrinkSection = displayItems.filter(isDrinkItem).length > 0;
    const foodCompleted = order.queue_status === "completed";
    const drinkCompleted = order.drink_queue_status === "completed";
    if (hasFoodSection && hasDrinkSection) return foodCompleted && drinkCompleted;
    if (hasFoodSection) return foodCompleted;
    if (hasDrinkSection) return drinkCompleted;
    return foodCompleted;
};

const DrinkQueuePage = () => {
    const [orders, setOrders] = useState<QueueOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const [completedToday, setCompletedToday] = useState(0);
    const [editingNotes, setEditingNotes] = useState<number | null>(null);
    const [notesValue, setNotesValue] = useState("");
    const [editingOrder, setEditingOrder] = useState<QueueOrder | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [holdDialogOrder, setHoldDialogOrder] = useState<QueueOrder | null>(null);
    const [holdReason, setHoldReason] = useState("");
    const { toast } = useToast();
    const prevOrdersRef = useRef<QueueOrder[]>([]);

    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
            osc1.connect(g1); g1.connect(ctx.destination);
            osc1.type = "sine"; osc1.frequency.setValueAtTime(900, ctx.currentTime);
            g1.gain.setValueAtTime(0.3, ctx.currentTime);
            g1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.6);
            const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
            osc2.connect(g2); g2.connect(ctx.destination);
            osc2.type = "sine"; osc2.frequency.setValueAtTime(700, ctx.currentTime + 0.5);
            g2.gain.setValueAtTime(0.3, ctx.currentTime + 0.5);
            g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
            osc2.start(ctx.currentTime + 0.5); osc2.stop(ctx.currentTime + 1.5);
        } catch (e) { console.error("Audio error", e); }
    };

    const speakNewOrder = () => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance("Pesanan Baru");
            utt.lang = "id-ID"; utt.rate = 1.0; utt.pitch = 1.1;
            const v = window.speechSynthesis.getVoices().find(v => v.lang.includes("id"));
            if (v) utt.voice = v;
            window.speechSynthesis.speak(utt);
        }
    };

    const fetchQueue = async () => {
        try {
            const res = await api.get("/queue");
            const data: QueueOrder[] = res.data;
            const isChanged = JSON.stringify(data) !== JSON.stringify(prevOrdersRef.current);
            if (isChanged) {
                const prevIds = new Set(prevOrdersRef.current.map(o => o.id));
                const newOrders = data.filter(o => !prevIds.has(o.id));
                const isFirst = prevOrdersRef.current.length === 0 && data.length > 0;
                if ((newOrders.length > 0 || isFirst) && (isFirst ? data : newOrders).some(o => o.queue_status !== "completed")) {
                    playNotificationSound();
                    if (newOrders.length > 0 && !isFirst) {
                        toast({ title: "🔔 Pesanan Masuk!", description: "Ada pesanan baru.", className: "bg-blue-600 text-white border-none shadow-lg" });
                        setTimeout(() => speakNewOrder(), 800);
                    }
                }
                const drinkOrders = data.filter(o => {
                    if (shouldHideOrder(o)) return false;
                    const items = getDisplayItems(o);
                    return items.filter(isDrinkItem).length > 0;
                }).sort((a, b) => {
                    const p: Record<string, number> = { in_progress: 0, pending: 1, hold: 2, completed: 3 };
                    return (p[a.queue_status] ?? 1) - (p[b.queue_status] ?? 1) || a.id - b.id;
                });
                setOrders(drinkOrders);
                // Menunggu = drink masih pending (belum dicentang selesai)
                setPendingCount(drinkOrders.filter(o => o.drink_queue_status !== "completed").length);
                prevOrdersRef.current = data;
            }
        } catch (e) {
            console.error("Error fetching queue:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const res = await api.get("/queue/statistics");
            setCompletedToday(res.data.completed_today ?? 0);
        } catch (e) {
            console.error("Error fetching statistics:", e);
        }
    };

    useEffect(() => {
        fetchQueue();
        fetchStatistics();
        const interval = setInterval(() => { fetchQueue(); fetchStatistics(); }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleDrinkStatusChange = async (orderId: number, completed: boolean) => {
        try {
            const res = await api.put(`/queue/${orderId}/drink-status`, { drink_queue_status: completed ? "completed" : "pending" });
            if (completed) {
                const updated = res.data?.order as QueueOrder | undefined;
                const order = orders.find(o => o.id === orderId);
                const toCheck = updated ?? (order ? { ...order, drink_queue_status: "completed" as const } : null);
                if (toCheck && shouldHideOrder(toCheck)) {
                    setOrders(prev => prev.filter(o => o.id !== orderId));
                    prevOrdersRef.current = prevOrdersRef.current.filter(o => o.id !== orderId);
                    toast({ title: "☕ Minuman Selesai!", description: "Dikeluarkan dari antrian.", className: "bg-blue-600 text-white border-none" });
                    fetchStatistics();
                    return;
                } else {
                    toast({ title: "☕ Minuman Selesai", description: "Minuman telah selesai dibuat!" });
                }
            } else {
                toast({ title: "↩ Dibatalkan", description: "Status minuman dikembalikan ke pending" });
            }
            fetchQueue();
            fetchStatistics();
        } catch (e) {
            toast({ title: "Error", description: "Gagal memperbarui status", variant: "destructive" });
        }
    };

    const handleHoldOrder = async () => {
        if (!holdDialogOrder) return;
        try {
            await api.put(`/queue/${holdDialogOrder.id}/drink-status`, { drink_queue_status: "hold", hold_reason: holdReason });
            toast({ title: "Berhasil", description: "Pesanan ditahan" });
            fetchQueue();
            setHoldDialogOrder(null);
            setHoldReason("");
        } catch (e) {
            toast({ title: "Error", description: "Gagal menahan pesanan", variant: "destructive" });
        }
    };

    const handleNotesUpdate = async (orderId: number) => {
        try {
            await api.put(`/queue/${orderId}/notes`, { notes: notesValue });
            toast({ title: "Berhasil", description: "Catatan diperbarui" });
            setEditingNotes(null);
            fetchQueue();
        } catch (e) {
            toast({ title: "Error", description: "Gagal memperbarui catatan", variant: "destructive" });
        }
    };

    const formatTime = (d: string) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
                        <p className="mt-4 text-muted-foreground">Memuat antrian minuman...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-blue-950/20 dark:via-cyan-950/10 dark:to-background">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-2xl">
                                <GlassWater className="h-8 w-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-wide">Antrian Minuman</h1>
                                <p className="text-blue-100 text-sm mt-0.5">
                                    {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                                </p>
                            </div>
                            <Badge className="bg-white/25 text-white border-white/30 animate-pulse ml-2">
                                ● LIVE
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-4 bg-white/15 rounded-2xl px-5 py-3">
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{completedToday}</div>
                                    <div className="text-[11px] text-blue-100">Selesai Hari Ini</div>
                                </div>
                                <div className="w-px h-10 bg-white/30" />
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{pendingCount}</div>
                                    <div className="text-[11px] text-blue-100">Menunggu</div>
                                </div>
                                <div className="w-px h-10 bg-white/30" />
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{orders.length}</div>
                                    <div className="text-[11px] text-blue-100">Dalam Antrian</div>
                                </div>
                            </div>
                            <button
                                onClick={() => { playNotificationSound(); setTimeout(() => speakNewOrder(), 800); }}
                                className="text-xs text-white/70 underline hover:text-white"
                            >Tes Suara</button>
                            <Button onClick={() => { fetchQueue(); fetchStatistics(); }} variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="bg-blue-100 dark:bg-blue-950/30 rounded-full p-6 mb-4">
                                <Coffee className="h-14 w-14 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-muted-foreground mb-1">Tidak ada antrian minuman</h2>
                            <p className="text-sm text-muted-foreground">Pesanan minuman akan muncul di sini secara otomatis</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {orders.map(order => {
                                const displayItems = getDisplayItems(order);
                                const drinkItems = displayItems.filter(isDrinkItem);
                                if (drinkItems.length === 0) return null;

                                const isReactivated = isOrderReactivated(order);
                                const originalDrinkItems = getOriginalDrinkItems(order);
                                const hasNewAddons = !isReactivated && drinkItems.some(i => i.is_addon);
                                const drinkCompleted = order.drink_queue_status === "completed";

                                const isHold = order.drink_queue_status === "hold";

                                let cardClass = "border-2 transition-all duration-200 hover:shadow-xl overflow-hidden ";
                                if (drinkCompleted) cardClass += "border-green-400 bg-green-50/80 dark:bg-green-950/20 opacity-80";
                                else if (isHold) cardClass += "border-slate-400 bg-slate-50 dark:bg-slate-900/30 ring-2 ring-slate-400/40 shadow-md opacity-90";
                                else if (isReactivated) cardClass += "border-red-500 bg-red-50 dark:bg-red-950/20 ring-2 ring-red-400/40 shadow-red-100 shadow-lg";
                                else if (hasNewAddons) cardClass += "border-purple-500 bg-purple-50 dark:bg-purple-950/20 ring-2 ring-purple-400/30 shadow-md";
                                else cardClass += "border-blue-300 bg-white dark:bg-blue-950/10 shadow-sm";

                                let barColor = "h-1.5 w-full ";
                                if (drinkCompleted) barColor += "bg-green-500";
                                else if (isHold) barColor += "bg-slate-500";
                                else if (isReactivated) barColor += "bg-red-500";
                                else if (hasNewAddons) barColor += "bg-purple-500";
                                else barColor += "bg-blue-400";

                                return (
                                    <Card key={order.id} className={cardClass}>
                                        <div className={barColor} />

                                        <CardContent className="p-4">
                                            {/* RE-ORDER Banner */}
                                            {isReactivated && !drinkCompleted && (
                                                <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs p-2 rounded-lg mb-3 font-bold border border-red-200 dark:border-red-800 flex items-center gap-2 animate-pulse">
                                                    <span className="text-base">🔄</span>
                                                    <div>RE-ORDER – TAMBAHAN BARU<div className="font-normal text-[10px] opacity-90">Pesanan sudah selesai, ada minuman tambahan</div></div>
                                                </div>
                                            )}

                                            {/* Normal Addon Banner */}
                                            {hasNewAddons && !drinkCompleted && (
                                                <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs p-2 rounded-lg mb-3 font-bold border border-purple-200 flex items-center gap-2 animate-pulse">
                                                    <span className="text-base">🔔</span>
                                                    <div>TAMBAHAN<div className="font-normal text-[10px] opacity-90">Ada item baru di pesanan ini</div></div>
                                                </div>
                                            )}

                                            {isHold && order.hold_reason && (
                                                <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs p-2 rounded-lg mb-3 font-medium border border-slate-300 dark:border-slate-600">
                                                    <span className="font-bold">Alasan Hold:</span> {order.hold_reason}
                                                </div>
                                            )}

                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-5xl font-black leading-none ${drinkCompleted ? "text-green-500" : isHold ? "text-slate-600" : isReactivated ? "text-red-500" : "text-blue-500"}`}>
                                                            #{order.daily_number}
                                                        </span>
                                                        <div className="flex flex-col gap-1">
                                                            <Badge
                                                                variant={order.order_type === "takeaway" ? "destructive" : "secondary"}
                                                                className="text-[10px] px-1.5 py-0.5 h-fit"
                                                            >
                                                                {order.order_type === "takeaway" ? "🥡 Bungkus" : "🍽️ Makan Sini"}
                                                            </Badge>
                                                            {isReactivated && (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit border-red-400 text-red-600 bg-red-50 animate-pulse">
                                                                    🔄 RE-ORDER
                                                                </Badge>
                                                            )}
                                                            {hasNewAddons && (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit border-purple-400 text-purple-600 bg-purple-50">
                                                                    + TAMBAHAN
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="font-bold text-sm truncate" title={order.customer_name || "Pelanggan"}>
                                                        {order.customer_name || "Pelanggan"}
                                                    </p>
                                                    {order.table && (
                                                        <Badge variant="outline" className="text-[10px] mt-1 border-primary text-primary bg-primary/10">
                                                            🪑 Meja {order.table.table_number}
                                                        </Badge>
                                                    )}
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatTime(order.created_at)}</p>
                                                </div>
                                            </div>

                                            {/* Drink Items Box */}
                                            <div className={`rounded-xl border-2 overflow-hidden mb-3 ${
                                                drinkCompleted ? "border-green-400"
                                                : isHold ? "border-slate-400"
                                                : isReactivated ? "border-red-400"
                                                : "border-blue-300"
                                            }`}>
                                                <div className={`flex items-center gap-2 px-3 py-2 text-white text-xs font-bold ${
                                                    drinkCompleted ? "bg-green-500"
                                                    : isHold ? "bg-slate-500"
                                                    : isReactivated ? "bg-red-500"
                                                    : "bg-blue-500"
                                                }`}>
                                                    <Coffee className="h-3.5 w-3.5" />
                                                    <span>{isReactivated ? "🔄 TAMBAHAN BARU" : "DAFTAR MINUMAN"}</span>
                                                    {drinkCompleted && <span className="ml-auto bg-white/25 px-1.5 py-0.5 rounded text-[10px]">✓ Selesai</span>}
                                                </div>
                                                <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto bg-white/60 dark:bg-transparent">
                                                    {/* Jika re-activated: item original greyed-out */}
                                                    {isReactivated && originalDrinkItems.length > 0 && (
                                                        <div className="mb-2 pb-2 border-b border-dashed border-gray-300">
                                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Pesanan Sebelumnya (sudah selesai):</p>
                                                            {originalDrinkItems.map(item => (
                                                                <div key={item.id} className="text-xs leading-relaxed opacity-40 line-through">
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className="font-black text-gray-500 text-sm">{item.quantity}×</span>
                                                                        <span className="font-medium truncate">{item.menu_item?.name || "Item Dihapus"}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {isReactivated && (
                                                        <p className="text-[9px] text-red-600 uppercase font-bold tracking-wider mb-1">↓ Buat Sekarang:</p>
                                                    )}
                                                    {drinkItems.map(item => (
                                                        <div key={item.id} className={`text-xs leading-relaxed ${
                                                            isReactivated
                                                                ? "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5"
                                                                : item.is_addon
                                                                    ? "bg-purple-50 dark:bg-purple-900/30 border border-purple-200 rounded-lg px-2 py-1"
                                                                    : ""
                                                        }`}>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className={`font-black text-sm ${
                                                                    isReactivated ? "text-red-600" : "text-blue-600"
                                                                }`}>{item.quantity}×</span>
                                                                <span className="font-medium truncate">{item.menu_item?.name || "Item Dihapus"}</span>
                                                                {item.is_takeaway && <span className="text-destructive text-[10px] font-semibold ml-1">(Bungkus)</span>}
                                                                {!isReactivated && item.is_addon && (
                                                                    <span className="text-purple-600 text-[10px] font-bold ml-1">● BARU</span>
                                                                )}
                                                            </div>
                                                            {item.note && <p className="text-[10px] text-muted-foreground italic pl-4 leading-tight">↳ {item.note}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Action Button */}
                                                <div className="flex flex-col gap-1 p-2 bg-white/40 dark:bg-transparent border-t border-blue-100 dark:border-blue-900/30">
                                                    {drinkCompleted ? (
                                                        <Button size="sm" variant="ghost" className="w-full h-8 text-xs text-green-700 hover:text-blue-700 hover:bg-blue-100" onClick={() => handleDrinkStatusChange(order.id, false)}>
                                                            <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Batalkan Selesai
                                                        </Button>
                                                    ) : (
                                                        <div className="flex gap-1 w-full">
                                                            <Button size="sm" className={`flex-1 h-8 text-xs text-white shadow-sm ${isReactivated ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`} onClick={() => handleDrinkStatusChange(order.id, true)}>
                                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> {isReactivated ? "Selesaikan Tambahan" : "Minuman Selesai"}
                                                            </Button>
                                                            {isHold ? (
                                                                <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-slate-500 text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-700 shadow-sm" onClick={async () => {
                                                                    await api.put(`/queue/${order.id}/drink-status`, { drink_queue_status: "pending" });
                                                                    fetchQueue();
                                                                }} title="Lanjutkan Pesanan">
                                                                    <RefreshCw className="h-4 w-4" />
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-blue-300 text-blue-500 hover:bg-blue-50 hover:text-blue-600 shadow-sm" onClick={() => {
                                                                    setHoldDialogOrder(order);
                                                                    setHoldReason("");
                                                                }} title="Tahan Pesanan">
                                                                    <Clock className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Notes */}
                                            <div className="border-t pt-2">
                                                <p className="text-[11px] font-semibold text-muted-foreground mb-1">📝 Catatan</p>
                                                {editingNotes === order.id ? (
                                                    <div className="space-y-1.5">
                                                        <Textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} placeholder="Catatan..." rows={2} className="text-xs" />
                                                        <div className="flex gap-1">
                                                            <Button size="sm" onClick={() => handleNotesUpdate(order.id)} className="text-xs h-7 flex-1">Simpan</Button>
                                                            <Button size="sm" variant="outline" onClick={() => { setEditingNotes(null); setNotesValue(""); }} className="text-xs h-7 flex-1">Batal</Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-2 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted text-xs min-h-[2.5rem] max-h-16 overflow-y-auto" onClick={() => { setEditingNotes(order.id); setNotesValue(order.notes || ""); }}>
                                                        {order.notes ? <span>{order.notes}</span> : <span className="text-muted-foreground italic">Klik untuk tambah catatan...</span>}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                                <p className="text-[11px] text-muted-foreground truncate">Kasir: {order.user.name}</p>
                                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={e => { e.stopPropagation(); setEditingOrder(order); setShowEditDialog(true); }}>
                                                    <Pencil className="h-3 w-3" /> Edit
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <EditQueueOrderDialog
                open={showEditDialog}
                onOpenChange={open => { setShowEditDialog(open); if (!open) setEditingOrder(null); }}
                order={editingOrder}
                onSuccess={() => { prevOrdersRef.current = []; fetchQueue(); fetchStatistics(); }}
            />

            <Dialog open={!!holdDialogOrder} onOpenChange={(open) => !open && setHoldDialogOrder(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Tahan Pesanan #{holdDialogOrder?.daily_number}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">
                            Alasan Pesanan Ditahan:
                        </label>
                        <Textarea
                            value={holdReason}
                            onChange={(e) => setHoldReason(e.target.value)}
                            placeholder="Contoh: Menunggu es batu, pelanggan belum bayar..."
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHoldDialogOrder(null)}>
                            Batal
                        </Button>
                        <Button
                            className="bg-slate-500 hover:bg-slate-600 text-white"
                            onClick={handleHoldOrder}
                            disabled={!holdReason.trim()}
                        >
                            Tahan Pesanan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
};

export default DrinkQueuePage;
