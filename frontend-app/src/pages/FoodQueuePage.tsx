import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth, HOLD_QUEUE_POSITIONS } from "@/hooks/useAuth";
import {
    ClipboardList, CheckCircle2, Clock, Package, Undo2,
    Utensils, Pencil, RefreshCw, ChefHat, Maximize2, Minimize2, Timer
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EditQueueOrderDialog } from "@/components/EditQueueOrderDialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { useOrderElapsed, formatElapsed, getElapsedColorClass, isUrgent, isWarning } from "@/hooks/useOrderElapsed";

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

const isFoodItem = (item: OrderItem) => {
    const cat = (item.menu_item?.category || "").toLowerCase();
    return !DRINK_CATEGORIES.includes(cat);
};

const isDrinkItem = (item: OrderItem) => {
    const cat = (item.menu_item?.category || "").toLowerCase();
    return DRINK_CATEGORIES.includes(cat);
};

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

/** Item original (bukan addon) untuk keperluan konteks pada tampilan re-order */
const getOriginalFoodItems = (order: QueueOrder) =>
    order.items.filter(i => !i.is_addon && isFoodItem(i)).sort((a, b) => a.id - b.id);

const shouldHideOrder = (order: QueueOrder): boolean => {
    const displayItems = getDisplayItems(order);
    const foodItems = displayItems.filter(isFoodItem);
    const drinkItems = displayItems.filter(isDrinkItem);
    const hasFoodSection = foodItems.length > 0;
    const hasDrinkSection = drinkItems.length > 0;
    const foodCompleted = order.queue_status === "completed";
    const drinkCompleted = order.drink_queue_status === "completed";
    if (hasFoodSection && hasDrinkSection) return foodCompleted && drinkCompleted;
    if (hasFoodSection) return foodCompleted;
    if (hasDrinkSection) return drinkCompleted;
    return foodCompleted;
};

const formatItemNote = (noteText: string | null | undefined, menuName: string | undefined): string => {
    if (!noteText) return "";
    const isBakso = menuName?.toLowerCase().includes("bakso");
    if (!isBakso) {
        return noteText.replace(/^(?:Kuah|Variasi):\s*/i, "");
    }
    return noteText;
};

// ─── Sub-komponen OrderCard dengan timer-nya sendiri ────────────────────────
interface OrderCardProps {
    order: QueueOrder;
    isFullscreen: boolean;
    canHold: boolean;
    editingNotes: number | null;
    notesValue: string;
    onFoodStatusChange: (id: number, completed: boolean) => void;
    onHoldClick: (order: QueueOrder) => void;
    onResumeHold: (id: number) => void;
    onEditNotes: (id: number, current: string) => void;
    onSaveNotes: (id: number) => void;
    onCancelNotes: () => void;
    onNotesChange: (val: string) => void;
    onEditOrder: (order: QueueOrder) => void;
}

const OrderCard = ({
    order, isFullscreen, canHold,
    editingNotes, notesValue,
    onFoodStatusChange, onHoldClick, onResumeHold,
    onEditNotes, onSaveNotes, onCancelNotes, onNotesChange,
    onEditOrder,
}: OrderCardProps) => {
    const elapsed = useOrderElapsed(order.created_at);
    const displayItems = getDisplayItems(order);
    const foodItems = displayItems.filter(isFoodItem);
    if (foodItems.length === 0) return null;

    const isReactivated = isOrderReactivated(order);
    const originalFoodItems = getOriginalFoodItems(order);
    const hasNewAddons = !isReactivated && foodItems.some(i => i.is_addon);
    const foodCompleted = order.queue_status === "completed";
    const isInProgress = order.queue_status === "in_progress";
    const isHold = order.queue_status === "hold";
    const urgent = !foodCompleted && !isHold && isUrgent(elapsed);
    const warning = !foodCompleted && !isHold && isWarning(elapsed);

    const formatTime = (d: string) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // Border & background
    let cardClass = "border-2 transition-all duration-200 hover:shadow-xl overflow-hidden ";
    if (foodCompleted) cardClass += "border-green-400 bg-green-50/80 dark:bg-green-950/20 opacity-80";
    else if (isHold) cardClass += "border-yellow-500 bg-yellow-50/80 dark:bg-yellow-950/30 ring-2 ring-yellow-400/40 shadow-yellow-100 shadow-md opacity-90";
    else if (urgent) cardClass += "border-red-500 bg-red-50 dark:bg-red-950/20 ring-2 ring-red-500/50 shadow-red-200 shadow-lg animate-pulse";
    else if (isReactivated) cardClass += "border-red-500 bg-red-50 dark:bg-red-950/20 ring-2 ring-red-400/40 shadow-red-100 shadow-lg";
    else if (hasNewAddons) cardClass += "border-purple-500 bg-purple-50 dark:bg-purple-950/20 ring-2 ring-purple-400/30 shadow-purple-100 shadow-md";
    else if (warning) cardClass += "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/10 shadow-md";
    else if (isInProgress) cardClass += "border-blue-400 bg-blue-50 dark:bg-blue-950/20 shadow-lg shadow-blue-100 scale-[1.01]";
    else cardClass += "border-orange-300 bg-white dark:bg-orange-950/10 shadow-sm";

    let barColor = "h-1.5 w-full ";
    if (foodCompleted) barColor += "bg-green-500";
    else if (isHold) barColor += "bg-yellow-500";
    else if (urgent) barColor += "bg-red-500";
    else if (isReactivated) barColor += "bg-red-500";
    else if (hasNewAddons) barColor += "bg-purple-500";
    else if (warning) barColor += "bg-yellow-400";
    else if (isInProgress) barColor += "bg-blue-500";
    else barColor += "bg-orange-400";

    return (
        <Card key={order.id} className={cardClass}>
            <div className={barColor} />

            <CardContent className={isFullscreen ? "p-3" : "p-4"}>
                {/* RE-ORDER Banner */}
                {isReactivated && !foodCompleted && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs p-2 rounded-lg mb-3 font-bold border border-red-200 dark:border-red-800 flex items-center gap-2 animate-pulse">
                        <span className="text-base">🔄</span>
                        <div>RE-ORDER – TAMBAHAN BARU<div className="font-normal text-[10px] opacity-90">Pesanan sudah selesai, ada item tambahan</div></div>
                    </div>
                )}

                {/* Normal Addon Banner */}
                {hasNewAddons && !foodCompleted && (
                    <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs p-2 rounded-lg mb-3 font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-2 animate-pulse">
                        <span className="text-base">🔔</span>
                        <div>TAMBAHAN<div className="font-normal text-[10px] opacity-90">Ada item baru di pesanan ini</div></div>
                    </div>
                )}

                {/* URGENT Banner */}
                {urgent && !foodCompleted && (
                    <div className="bg-red-600 text-white text-xs p-2 rounded-lg mb-3 font-bold flex items-center gap-2">
                        <Timer className="h-3.5 w-3.5 shrink-0" />
                        <span>PESANAN TERLAMBAT! Segera selesaikan.</span>
                    </div>
                )}

                {isHold && order.hold_reason && (
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs p-2 rounded-lg mb-3 font-medium border border-yellow-300 dark:border-yellow-700">
                        <span className="font-bold">Alasan Hold:</span> {order.hold_reason}
                    </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`${isFullscreen ? "text-6xl" : "text-5xl"} font-black leading-none ${foodCompleted ? "text-green-500" : isHold ? "text-yellow-600" : urgent ? "text-red-500" : isReactivated ? "text-red-500" : "text-orange-500"}`}>
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
                        <p className={`font-bold truncate ${isFullscreen ? "text-base" : "text-sm"}`} title={order.customer_name || "Pelanggan"}>
                            {order.customer_name || "Pelanggan"}
                        </p>
                        {order.table && (
                            <Badge variant="outline" className="text-[10px] mt-1 border-primary text-primary bg-primary/10">
                                🪑 Meja {order.table.table_number}
                            </Badge>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatTime(order.created_at)}</p>
                    </div>

                    {/* Timer */}
                    {!foodCompleted && (
                        <div className={`flex flex-col items-center ml-2 shrink-0 px-2 py-1 rounded-xl border-2 ${
                            urgent ? "border-red-500 bg-red-50 dark:bg-red-900/20" :
                            warning ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20" :
                            "border-orange-200 bg-orange-50/50 dark:bg-orange-900/10"
                        }`}>
                            <Timer className={`h-3 w-3 mb-0.5 ${urgent ? "text-red-500" : warning ? "text-yellow-500" : "text-orange-400"}`} />
                            <span className={`text-sm leading-none tabular-nums ${getElapsedColorClass(elapsed)}`}>
                                {formatElapsed(elapsed)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Food Items Box */}
                <div className={`rounded-xl border-2 overflow-hidden mb-3 ${
                    foodCompleted ? "border-green-400"
                    : isHold ? "border-yellow-400"
                    : urgent ? "border-red-500"
                    : isReactivated ? "border-red-400"
                    : "border-orange-300"
                }`}>
                    {/* Section Header */}
                    <div className={`flex items-center gap-2 px-3 py-2 text-white text-xs font-bold ${
                        foodCompleted ? "bg-green-500"
                        : isHold ? "bg-yellow-500"
                        : urgent ? "bg-red-600"
                        : isReactivated ? "bg-red-500"
                        : "bg-orange-500"
                    }`}>
                        <Utensils className="h-3.5 w-3.5" />
                        <span>{isReactivated ? "🔄 TAMBAHAN BARU" : "DAFTAR MAKANAN"}</span>
                        {foodCompleted && <span className="ml-auto bg-white/25 px-1.5 py-0.5 rounded text-[10px]">✓ Selesai</span>}
                    </div>

                    <div className={`px-3 py-2 space-y-1.5 overflow-y-auto bg-white/60 dark:bg-transparent ${isFullscreen ? "max-h-60" : "max-h-48"}`}>
                        {/* Jika re-activated: tampilkan item original greyed-out sebagai konteks */}
                        {isReactivated && originalFoodItems.length > 0 && (
                            <div className="mb-2 pb-2 border-b border-dashed border-gray-300">
                                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Pesanan Sebelumnya (sudah selesai):</p>
                                {originalFoodItems.map(item => (
                                    <div key={item.id} className="text-xs leading-relaxed opacity-40 line-through">
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-black text-gray-500 text-sm">{item.quantity}×</span>
                                            <span className="font-medium truncate">{item.menu_item?.name || "Item Dihapus"}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Item utama yang perlu dibuat */}
                        {isReactivated && (
                            <p className="text-[9px] text-red-600 uppercase font-bold tracking-wider mb-1">↓ Buat Sekarang:</p>
                        )}
                        {foodItems.map(item => (
                            <div key={item.id} className={`text-xs leading-relaxed ${
                                isReactivated
                                    ? "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5"
                                    : item.is_addon
                                        ? "bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-1"
                                        : ""
                            }`}>
                                <div className="flex items-baseline gap-1">
                                    <span className={`font-black text-sm ${isReactivated ? "text-red-600" : "text-orange-600"}`}>{item.quantity}×</span>
                                    <span className={`font-medium truncate ${isFullscreen ? "text-sm" : ""}`}>{item.menu_item?.name || "Item Dihapus"}</span>
                                    {item.is_takeaway && <span className="text-destructive text-[10px] font-semibold ml-1">(Bungkus)</span>}
                                    {!isReactivated && item.is_addon && (
                                        <span className="text-purple-600 text-[10px] font-bold ml-1">● BARU</span>
                                    )}
                                </div>
                                {item.note && <p className="text-[10px] text-muted-foreground italic pl-4 leading-tight">↳ {formatItemNote(item.note, item.menu_item?.name)}</p>}
                            </div>
                        ))}
                    </div>

                    {/* Action Button */}
                    <div className="flex flex-col gap-1 p-2 bg-white/40 dark:bg-transparent border-t border-orange-100 dark:border-orange-900/30">
                        {foodCompleted ? (
                            <Button size="sm" variant="ghost" className="w-full h-8 text-xs text-green-700 hover:text-orange-700 hover:bg-orange-100" onClick={() => onFoodStatusChange(order.id, false)}>
                                <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Batalkan Selesai
                            </Button>
                        ) : (
                            <div className="flex gap-1 w-full">
                                <Button
                                    size="sm"
                                    className={`flex-1 h-8 text-xs text-white shadow-sm ${urgent ? "bg-red-600 hover:bg-red-700" : isReactivated ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"}`}
                                    onClick={() => onFoodStatusChange(order.id, true)}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> {isReactivated ? "Selesaikan Tambahan" : "Makanan Selesai"}
                                </Button>
                                {canHold && (isHold ? (
                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-yellow-500 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 hover:text-yellow-700 shadow-sm" onClick={() => onResumeHold(order.id)} title="Lanjutkan Pesanan">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-orange-300 text-orange-500 hover:bg-orange-50 hover:text-orange-600 shadow-sm" onClick={() => onHoldClick(order)} title="Tahan Pesanan">
                                        <Clock className="h-4 w-4" />
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Notes */}
                {!isFullscreen && (
                    <div className="border-t pt-2">
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">📝 Catatan</p>
                        {editingNotes === order.id ? (
                            <div className="space-y-1.5">
                                <Textarea value={notesValue} onChange={e => onNotesChange(e.target.value)} placeholder="Catatan..." rows={2} className="text-xs" />
                                <div className="flex gap-1">
                                    <Button size="sm" onClick={() => onSaveNotes(order.id)} className="text-xs h-7 flex-1">Simpan</Button>
                                    <Button size="sm" variant="outline" onClick={onCancelNotes} className="text-xs h-7 flex-1">Batal</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-2 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted text-xs min-h-[2.5rem] max-h-16 overflow-y-auto" onClick={() => onEditNotes(order.id, order.notes || "")}>
                                {order.notes ? <span>{order.notes}</span> : <span className="text-muted-foreground italic">Klik untuk tambah catatan...</span>}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-2 pt-2 border-t flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground truncate">Kasir: {order.user.name}</p>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={e => { e.stopPropagation(); onEditOrder(order); }}>
                        <Pencil className="h-3 w-3" /> Edit
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

// ─── Halaman Utama ───────────────────────────────────────────────────────────
const FoodQueuePage = () => {
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
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { toast } = useToast();
    const { canEdit, hasAnyPosition } = useAuth();
    const canHold = canEdit() || hasAnyPosition(HOLD_QUEUE_POSITIONS);
    const prevOrdersRef = useRef<QueueOrder[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // ── Fullscreen handler ──────────────────────────────────────────────────
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(() => {});
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    // ── Audio ───────────────────────────────────────────────────────────────
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
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang.includes("id"));
            if (v) utt.voice = v;
            window.speechSynthesis.speak(utt);
        }
    };

    const speakFoodCompleted = (customerName: string, order: QueueOrder) => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const isFullTakeaway = order.order_type === 'takeaway';
            const hasAnyTakeawayItem = order.items.some(i => i.is_takeaway);
            let text = `Pesanan atas nama ${customerName}`;
            if (isFullTakeaway || hasAnyTakeawayItem) text += `, Dibungkus`;
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = "id-ID"; utt.rate = 0.9; utt.pitch = 1;
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang.includes("id"));
            if (v) utt.voice = v;
            window.speechSynthesis.speak(utt);
        }
    };

    // ── Data Fetching ───────────────────────────────────────────────────────
    const fetchQueue = async () => {
        try {
            const res = await api.get("/queue");
            const data: QueueOrder[] = res.data;
            const isChanged = JSON.stringify(data) !== JSON.stringify(prevOrdersRef.current);
            if (isChanged) {
                const prevIds = new Set(prevOrdersRef.current.map(o => o.id));
                const newOrders = data.filter(o => !prevIds.has(o.id));
                const isFirst = prevOrdersRef.current.length === 0 && data.length > 0;
                if (newOrders.length > 0 || isFirst) {
                    const hasActive = isFirst
                        ? data.some(o => o.queue_status !== "completed")
                        : newOrders.some(o => o.queue_status !== "completed");
                    if (hasActive) {
                        playNotificationSound();
                        if (newOrders.length > 0 && !isFirst) {
                            toast({ title: "🔔 Pesanan Masuk!", description: "Ada pesanan baru.", className: "bg-green-600 text-white border-none shadow-lg" });
                            setTimeout(() => speakNewOrder(), 800);
                        }
                    }
                }
                const foodOrders = data.filter(o => {
                    if (shouldHideOrder(o)) return false;
                    const items = getDisplayItems(o);
                    return items.filter(isFoodItem).length > 0;
                }).sort((a, b) => {
                    const p = { in_progress: 0, pending: 1, hold: 2, completed: 3 };
                    return p[a.queue_status] - p[b.queue_status] || a.id - b.id;
                });
                setOrders(foodOrders);
                setPendingCount(foodOrders.filter(o => o.queue_status !== "completed").length);
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

    // ── Actions ─────────────────────────────────────────────────────────────
    const handleFoodStatusChange = async (orderId: number, completed: boolean) => {
        try {
            if (completed) {
                const order = orders.find(o => o.id === orderId);
                if (order?.customer_name) speakFoodCompleted(order.customer_name, order);
            }
            const res = await api.put(`/queue/${orderId}/status`, { queue_status: completed ? "completed" : "pending" });
            if (completed) {
                const updated = res.data?.order as QueueOrder | undefined;
                if (updated && shouldHideOrder(updated)) {
                    setOrders(prev => prev.filter(o => o.id !== orderId));
                    prevOrdersRef.current = prevOrdersRef.current.filter(o => o.id !== orderId);
                    toast({ title: "✅ Makanan Selesai!", description: "Dikeluarkan dari antrian.", className: "bg-green-600 text-white border-none" });
                    fetchStatistics();
                    return;
                }
            }
            toast({ title: completed ? "✅ Makanan Selesai" : "↩ Dibatalkan", description: completed ? "Makanan telah selesai!" : "Dikembalikan ke antrian" });
            fetchQueue();
            fetchStatistics();
        } catch (e) {
            toast({ title: "Error", description: "Gagal memperbarui status", variant: "destructive" });
        }
    };

    const handleHoldOrder = async () => {
        if (!holdDialogOrder) return;
        try {
            await api.put(`/queue/${holdDialogOrder.id}/status`, { queue_status: "hold", hold_reason: holdReason });
            toast({ title: "Berhasil", description: "Pesanan ditahan" });
            fetchQueue();
            setHoldDialogOrder(null);
            setHoldReason("");
        } catch (e) {
            toast({ title: "Error", description: "Gagal menahan pesanan", variant: "destructive" });
        }
    };

    const handleResumeHold = async (orderId: number) => {
        await api.put(`/queue/${orderId}/status`, { queue_status: "pending" });
        fetchQueue();
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

    // ── Render ──────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                        <p className="mt-4 text-muted-foreground">Memuat antrian makanan...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const pageContent = (
        <div
            ref={containerRef}
            className={`min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/20 dark:via-amber-950/10 dark:to-background ${isFullscreen ? "overflow-y-auto" : ""}`}
        >
            {/* Header */}
            <div className={`bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg ${isFullscreen ? "px-4 py-3 sticky top-0 z-10" : "px-6 py-5"}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2.5 rounded-2xl">
                            <ChefHat className={isFullscreen ? "h-7 w-7" : "h-8 w-8"} />
                        </div>
                        <div>
                            <h1 className={`font-bold tracking-wide ${isFullscreen ? "text-xl" : "text-2xl"}`}>Antrian Makanan</h1>
                            {!isFullscreen && (
                                <p className="text-orange-100 text-sm mt-0.5">
                                    {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                                </p>
                            )}
                        </div>
                        <Badge className="bg-white/25 text-white border-white/30 animate-pulse ml-1">
                            ● LIVE
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Stats */}
                        <div className={`hidden sm:flex items-center gap-4 bg-white/15 rounded-2xl px-4 py-2.5`}>
                            <div className="text-center">
                                <div className={`font-bold ${isFullscreen ? "text-xl" : "text-2xl"}`}>{completedToday}</div>
                                <div className="text-[11px] text-orange-100">Selesai</div>
                            </div>
                            <div className="w-px h-8 bg-white/30" />
                            <div className="text-center">
                                <div className={`font-bold ${isFullscreen ? "text-xl" : "text-2xl"}`}>{pendingCount}</div>
                                <div className="text-[11px] text-orange-100">Menunggu</div>
                            </div>
                            <div className="w-px h-8 bg-white/30" />
                            <div className="text-center">
                                <div className={`font-bold ${isFullscreen ? "text-xl" : "text-2xl"}`}>{orders.length}</div>
                                <div className="text-[11px] text-orange-100">Antrian</div>
                            </div>
                        </div>

                        <button
                            onClick={() => { playNotificationSound(); setTimeout(() => speakNewOrder(), 800); }}
                            className="text-xs text-white/70 underline hover:text-white hidden sm:block"
                        >Tes Suara</button>

                        <Button onClick={() => { fetchQueue(); fetchStatistics(); }} variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                            <RefreshCw className="h-4 w-4" />
                            {!isFullscreen && <span className="ml-1">Refresh</span>}
                        </Button>

                        {/* Fullscreen Toggle */}
                        <Button onClick={toggleFullscreen} variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30" title={isFullscreen ? "Keluar Fullscreen" : "Mode Fullscreen"}>
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={isFullscreen ? "p-3" : "p-6"}>
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="bg-orange-100 dark:bg-orange-950/30 rounded-full p-6 mb-4">
                            <ChefHat className="h-14 w-14 text-orange-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-muted-foreground mb-1">Tidak ada antrian makanan</h2>
                        <p className="text-sm text-muted-foreground">Pesanan makanan akan muncul di sini secara otomatis</p>
                    </div>
                ) : (
                    <div className={`grid gap-3 ${isFullscreen
                        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                    }`}>
                        {orders.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                isFullscreen={isFullscreen}
                                canHold={canHold}
                                editingNotes={editingNotes}
                                notesValue={notesValue}
                                onFoodStatusChange={handleFoodStatusChange}
                                onHoldClick={(o) => { setHoldDialogOrder(o); setHoldReason(""); }}
                                onResumeHold={handleResumeHold}
                                onEditNotes={(id, val) => { setEditingNotes(id); setNotesValue(val); }}
                                onSaveNotes={handleNotesUpdate}
                                onCancelNotes={() => { setEditingNotes(null); setNotesValue(""); }}
                                onNotesChange={setNotesValue}
                                onEditOrder={(o) => { setEditingOrder(o); setShowEditDialog(true); }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return isFullscreen ? (
        <>
            {pageContent}
            <EditQueueOrderDialog
                open={showEditDialog}
                onOpenChange={open => { setShowEditDialog(open); if (!open) setEditingOrder(null); }}
                order={editingOrder}
                onSuccess={() => { prevOrdersRef.current = []; fetchQueue(); }}
            />
            <Dialog open={!!holdDialogOrder} onOpenChange={(open) => !open && setHoldDialogOrder(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Tahan Pesanan #{holdDialogOrder?.daily_number}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Alasan Pesanan Ditahan:</label>
                        <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Contoh: Menunggu item tambahan, pelanggan belum kembali..." className="min-h-[100px]" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHoldDialogOrder(null)}>Batal</Button>
                        <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleHoldOrder} disabled={!holdReason.trim()}>Tahan Pesanan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    ) : (
        <MainLayout>
            {pageContent}
            <EditQueueOrderDialog
                open={showEditDialog}
                onOpenChange={open => { setShowEditDialog(open); if (!open) setEditingOrder(null); }}
                order={editingOrder}
                onSuccess={() => { prevOrdersRef.current = []; fetchQueue(); }}
            />
            <Dialog open={!!holdDialogOrder} onOpenChange={(open) => !open && setHoldDialogOrder(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Tahan Pesanan #{holdDialogOrder?.daily_number}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Alasan Pesanan Ditahan:</label>
                        <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Contoh: Menunggu item tambahan, pelanggan belum kembali..." className="min-h-[100px]" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHoldDialogOrder(null)}>Batal</Button>
                        <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleHoldOrder} disabled={!holdReason.trim()}>Tahan Pesanan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
};

export default FoodQueuePage;
