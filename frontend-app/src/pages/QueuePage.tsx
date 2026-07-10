import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth, HOLD_QUEUE_POSITIONS } from "@/hooks/useAuth";
import { ClipboardList, CheckCircle2, Clock, Package, Undo2, Utensils, Coffee, Pencil, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EditQueueOrderDialog } from "@/components/EditQueueOrderDialog";
import { Link } from "react-router-dom";
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
    hold_reason?: string | null;
    drink_hold_reason?: string | null;
    notes: string | null;
    created_at: string;
    order_type?: "dine_in" | "takeaway";
    items: OrderItem[];
    user: {
        id: number;
        name: string;
    };
    queue_completed_at: string | null;
    payment_status: "pending" | "paid";
    payment_method?: string;
    paid_amount?: number;
    second_paid_amount?: number;
    change_amount?: number;
    table?: {
        id: number;
        table_number: string;
        capacity: number;
    } | null;
}

interface QueueStatistics {
    pending: number;
    in_progress: number;
    completed_today: number;
    total_in_queue: number;
}

// Daftar kategori yang termasuk minuman
const DRINK_CATEGORIES = ["minuman", "drink", "beverage", "drinks"];
// Daftar kategori yang termasuk makanan
const FOOD_CATEGORIES = ["makanan", "food", "snack", "camilan", "dessert"];

const isFoodItem = (item: OrderItem) => {
    const cat = (item.menu_item?.category || "").toLowerCase();
    return !DRINK_CATEGORIES.includes(cat);
};

const formatItemNote = (noteText: string | null | undefined, menuName: string | undefined): string => {
    if (!noteText) return "";
    const isBakso = menuName?.toLowerCase().includes("bakso");
    if (!isBakso) {
        return noteText.replace(/^(?:Kuah|Variasi):\s*/i, "");
    }
    return noteText;
};

const isDrinkItem = (item: OrderItem) => {
    const cat = (item.menu_item?.category || "").toLowerCase();
    return DRINK_CATEGORIES.includes(cat);
};

const QueuePage = () => {
    const [orders, setOrders] = useState<QueueOrder[]>([]);
    const [statistics, setStatistics] = useState<QueueStatistics>({
        pending: 0,
        in_progress: 0,
        completed_today: 0,
        total_in_queue: 0,
    });
    const [loading, setLoading] = useState(true);
    const [editingNotes, setEditingNotes] = useState<number | null>(null);
    const [notesValue, setNotesValue] = useState("");
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const { toast } = useToast();
    const { canEdit, hasAnyPosition } = useAuth();
    // Hold/lanjutkan pesanan: admin & owner, atau jabatan dapur/manajemen (mis. Kitchen Assistant)
    const canHold = canEdit() || hasAnyPosition(HOLD_QUEUE_POSITIONS);
    const prevOrdersRef = useRef<QueueOrder[]>([]);
    const [editingOrder, setEditingOrder] = useState<QueueOrder | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    // Hold terpisah untuk makanan & minuman — hold makanan TIDAK menahan minuman, dan sebaliknya
    const [holdTarget, setHoldTarget] = useState<{ order: QueueOrder; type: "food" | "drink" } | null>(null);
    const [holdReason, setHoldReason] = useState("");

    // Helper: Apakah order ini harus disembunyikan dari antrian?
    // Order tersembunyi HANYA jika SEMUA section yang ada sudah selesai:
    // - Jika punya makanan & minuman → keduanya harus selesai
    // - Jika hanya makanan → makanan harus selesai (drink_queue_status diabaikan)
    // - Jika hanya minuman → minuman harus selesai (queue_status diabaikan)
    const shouldHideOrder = (order: QueueOrder): boolean => {
        const isReactivated = !!(order.queue_completed_at && order.queue_status !== 'completed');

        // Hitung displayItems persis seperti di render
        const displayItems = isReactivated
            ? order.items.filter(i => {
                if (!i.is_addon) return false;
                const cat = (i.menu_item?.category || "").toLowerCase();
                return ["makanan", "minuman"].includes(cat);
            })
            : [...order.items].sort((a, b) => a.id - b.id);

        const foodItems = displayItems.filter(isFoodItem);
        const drinkItems = displayItems.filter(isDrinkItem);

        const hasFoodSection = foodItems.length > 0;
        const hasDrinkSection = drinkItems.length > 0;

        const foodCompleted = order.queue_status === 'completed';
        const drinkCompleted = order.drink_queue_status === 'completed';

        if (hasFoodSection && hasDrinkSection) {
            // Ada keduanya → keduanya harus selesai
            return foodCompleted && drinkCompleted;
        } else if (hasFoodSection) {
            // Hanya ada makanan → makanan harus selesai
            return foodCompleted;
        } else if (hasDrinkSection) {
            // Hanya ada minuman → minuman harus selesai
            return drinkCompleted;
        }

        // Tidak ada item terkategorisasi → pakai logika lama (cek food)
        return foodCompleted;
    };

    // Audio notifikasi: Efek "Ding-Dong" (seperti bel pintu/restoran)
    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const audioContext = new AudioContext();

            // Tone 1: Tinggi (Ding)
            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.connect(gain1);
            gain1.connect(audioContext.destination);
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(900, audioContext.currentTime);
            gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
            osc1.start(audioContext.currentTime);
            osc1.stop(audioContext.currentTime + 0.6);

            // Tone 2: Rendah (Dong) - Delay dikit
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(700, audioContext.currentTime + 0.5);
            gain2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.5);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
            osc2.start(audioContext.currentTime + 0.5);
            osc2.stop(audioContext.currentTime + 1.5);

        } catch (e) {
            console.error("Gagal memutar audio (butuh interaksi user/klik sekali)", e);
        }
    };

    const fetchQueue = async () => {
        try {
            const response = await api.get('/queue');
            const data: QueueOrder[] = response.data;

            // Smart Update Logic
            const isDataChanged = JSON.stringify(data) !== JSON.stringify(prevOrdersRef.current);

            if (isDataChanged) {
                const prevIds = new Set(prevOrdersRef.current.map(o => o.id));
                const newOrdersList = data.filter(o => !prevIds.has(o.id));
                const isFirstLoad = prevOrdersRef.current.length === 0 && data.length > 0;

                if (newOrdersList.length > 0 || isFirstLoad) {
                    const hasActiveOrders = isFirstLoad
                        ? data.some(o => o.queue_status !== 'completed')
                        : newOrdersList.some(o => o.queue_status !== 'completed');

                    if (hasActiveOrders) {
                        playNotificationSound();
                        if (newOrdersList.length > 0 && !isFirstLoad) {
                            toast({
                                title: "🔔 Pesanan Masuk!",
                                description: "Ada pesanan baru di antrian.",
                                className: "bg-green-600 text-white border-none shadow-lg",
                            });

                            setTimeout(() => {
                                speakNewOrder();
                            }, 800);
                        }
                    }
                }

                const sortedData = [...data]
                    .filter(order => !shouldHideOrder(order))
                    .sort((a, b) => {
                        const statusPriority = { in_progress: 0, pending: 1, hold: 2, completed: 3 };
                        return statusPriority[a.queue_status] - statusPriority[b.queue_status] || a.id - b.id;
                    });

                setOrders(sortedData);
                prevOrdersRef.current = data;
                setLastUpdate(new Date());
            }

        } catch (error) {
            console.error("Error fetching queue:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const response = await api.get('/queue/statistics');
            setStatistics(response.data);
        } catch (error) {
            console.error("Error fetching statistics:", error);
        }
    };

    useEffect(() => {
        fetchQueue();
        fetchStatistics();

        const interval = setInterval(() => {
            fetchQueue();
            fetchStatistics();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Fungsi Text-to-Speech - hanya untuk makanan (food)
    // Jika dine_in: cukup panggil nama saja (tanpa "Makan Sini")
    // Jika takeaway atau ada item bungkus: panggil nama + "Dibungkus"
    const speakOrderCompleted = (customerName: string, order: QueueOrder) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const isFullTakeaway = order.order_type === 'takeaway';
            const hasAnyTakeawayItem = order.items.some(i => i.is_takeaway);
            let textToSpeak = `Pesanan atas nama ${customerName}`;
            if (isFullTakeaway || hasAnyTakeawayItem) {
                textToSpeak += `, Dibungkus`;
            }
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.lang = 'id-ID';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            const voices = window.speechSynthesis.getVoices();
            const indoVoice = voices.find(v => v.lang.includes('id'));
            if (indoVoice) utterance.voice = indoVoice;
            window.speechSynthesis.speak(utterance);
        }
    };

    const speakNewOrder = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance("Pesanan Baru");
            utterance.lang = 'id-ID';
            utterance.rate = 1.0;
            utterance.pitch = 1.1;
            const voices = window.speechSynthesis.getVoices();
            const indoVoice = voices.find(v => v.lang.includes('id'));
            if (indoVoice) utterance.voice = indoVoice;
            window.speechSynthesis.speak(utterance);
        }
    };

    // Update status antrian MAKANAN
    const handleFoodStatusChange = async (orderId: number, completed: boolean) => {
        try {
            const newStatus = completed ? "completed" : "pending";

            if (completed) {
                const order = orders.find(o => o.id === orderId);
                if (order && order.customer_name) {
                    // TTS hanya untuk makanan
                    speakOrderCompleted(order.customer_name, order);
                }
            }

            const response = await api.put(`/queue/${orderId}/status`, { queue_status: newStatus });

            // Cek apakah order sekarang harus disembunyikan dari antrian
            if (completed) {
                const updatedOrder = response.data?.order as QueueOrder | undefined;
                if (updatedOrder) {
                    const hide = shouldHideOrder(updatedOrder);
                    if (hide) {
                        // Hapus dari state DAN update prevOrdersRef agar interval tidak mengembalikannya
                        setOrders(prev => prev.filter(o => o.id !== orderId));
                        prevOrdersRef.current = prevOrdersRef.current.filter(o => o.id !== orderId);
                        toast({
                            title: "✅ Pesanan Selesai!",
                            description: "Semua item selesai, dikeluarkan dari antrian.",
                            className: "bg-green-600 text-white border-none shadow-lg",
                        });
                        fetchStatistics();
                        return;
                    }
                }
            }

            toast({
                title: completed ? "✅ Makanan Selesai" : "↩ Makanan Dikembalikan",
                description: completed
                    ? "Makanan telah selesai dibuat!"
                    : "Dikembalikan ke antrian",
                className: completed ? "bg-orange-600 text-white border-none" : "",
            });

            fetchQueue();
            fetchStatistics();
        } catch (error) {
            console.error("Error updating food status:", error);
            toast({
                title: "Error",
                description: "Gagal memperbarui status makanan",
                variant: "destructive",
            });
        }
    };

    // Update status antrian MINUMAN (tanpa TTS, tanpa notifikasi suara)
    const handleDrinkStatusChange = async (orderId: number, completed: boolean) => {
        try {
            const newStatus = completed ? "completed" : "pending";
            const response = await api.put(`/queue/${orderId}/drink-status`, { drink_queue_status: newStatus });

            if (completed) {
                const updatedOrder = response.data?.order as QueueOrder | undefined;
                const order = orders.find(o => o.id === orderId);
                const isReactivated = !!(order?.queue_completed_at && order?.queue_status !== 'completed');

                // Buat objek order dengan drink_queue_status = 'completed' untuk cek
                const orderToCheck = updatedOrder ?? (order ? { ...order, drink_queue_status: 'completed' as const } : null);
                const hide = orderToCheck ? shouldHideOrder(orderToCheck) : false;

                if (hide) {
                    // Hapus dari state DAN update prevOrdersRef agar interval tidak mengembalikannya
                    setOrders(prev => prev.filter(o => o.id !== orderId));
                    prevOrdersRef.current = prevOrdersRef.current.filter(o => o.id !== orderId);
                    toast({
                        title: "✅ Selesai!",
                        description: isReactivated
                            ? "Tambahan selesai, dikeluarkan dari antrian."
                            : "Pesanan hanya minuman, dikeluarkan dari antrian.",
                        className: "bg-green-600 text-white border-none shadow-lg",
                    });
                    fetchStatistics();
                    return;
                } else {
                    toast({
                        title: "☕ Minuman Selesai",
                        description: "Minuman telah selesai dibuat! Menunggu makanan selesai.",
                    });
                }
            } else {
                toast({
                    title: "↩ Minuman Dikembalikan",
                    description: "Status minuman dikembalikan ke pending",
                });
            }

            fetchQueue();
            fetchStatistics();
        } catch (error) {
            console.error("Error updating drink status:", error);
            toast({
                title: "Error",
                description: "Gagal memperbarui status minuman",
                variant: "destructive",
            });
        }
    };

    // Tahan pesanan (hold) — makanan & minuman ditahan TERPISAH
    const handleHoldSubmit = async () => {
        if (!holdTarget) return;
        try {
            if (holdTarget.type === "food") {
                await api.put(`/queue/${holdTarget.order.id}/status`, { queue_status: "hold", hold_reason: holdReason });
            } else {
                await api.put(`/queue/${holdTarget.order.id}/drink-status`, { drink_queue_status: "hold", hold_reason: holdReason });
            }
            toast({
                title: "⏸ Pesanan Ditahan",
                description: `${holdTarget.type === "food" ? "Makanan" : "Minuman"} #${holdTarget.order.daily_number} ditahan${holdReason ? `: ${holdReason}` : ""}`,
                className: "bg-yellow-600 text-white border-none",
            });
            setHoldTarget(null);
            setHoldReason("");
            fetchQueue();
            fetchStatistics();
        } catch (error: any) {
            console.error("Error holding order:", error);
            toast({
                title: "Error",
                description: error.response?.data?.message || "Gagal menahan pesanan",
                variant: "destructive",
            });
        }
    };

    // Lanjutkan pesanan dari hold → pending
    const handleResume = async (orderId: number, type: "food" | "drink") => {
        try {
            if (type === "food") {
                await api.put(`/queue/${orderId}/status`, { queue_status: "pending" });
            } else {
                await api.put(`/queue/${orderId}/drink-status`, { drink_queue_status: "pending" });
            }
            toast({
                title: "▶ Pesanan Dilanjutkan",
                description: `${type === "food" ? "Makanan" : "Minuman"} kembali ke antrian`,
            });
            fetchQueue();
            fetchStatistics();
        } catch (error: any) {
            console.error("Error resuming order:", error);
            toast({
                title: "Error",
                description: error.response?.data?.message || "Gagal melanjutkan pesanan",
                variant: "destructive",
            });
        }
    };

    const handleNotesUpdate = async (orderId: number) => {
        try {
            await api.put(`/queue/${orderId}/notes`, { notes: notesValue });
            toast({
                title: "Berhasil",
                description: "Catatan diperbarui",
            });
            setEditingNotes(null);
            fetchQueue();
        } catch (error) {
            console.error("Error updating notes:", error);
            toast({
                title: "Error",
                description: "Gagal memperbarui catatan",
                variant: "destructive",
            });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Memuat antrian...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-display font-bold">Daftar Antrian</h1>
                            <Badge className="bg-green-500 text-white animate-pulse">
                                ● LIVE
                            </Badge>
                        </div>
                        <p className="text-muted-foreground">
                            Antrian pesanan hari ini ({new Date().toLocaleDateString('id-ID', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })})
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                Menunggu pesanan baru...
                            </p>
                            <button
                                onClick={() => {
                                    playNotificationSound();
                                    setTimeout(() => speakNewOrder(), 800);
                                }}
                                className="text-[10px] text-muted-foreground underline hover:text-primary"
                                title="Klik untuk tes suara notifikasi & TTS"
                            >
                                Tes Suara
                            </button>
                        </div>
                    </div>
                    <Button onClick={() => { fetchQueue(); fetchStatistics(); }} variant="outline">
                        Refresh Manual
                    </Button>
                </div>

                {/* Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Antrian</CardTitle>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.total_in_queue}</div>
                            <p className="text-xs text-muted-foreground">Pesanan dalam antrian</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Menunggu</CardTitle>
                            <Clock className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.pending}</div>
                            <p className="text-xs text-muted-foreground">Belum diproses</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Diproses</CardTitle>
                            <Package className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.in_progress}</div>
                            <p className="text-xs text-muted-foreground">Sedang dikerjakan</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Selesai Hari Ini</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.completed_today}</div>
                            <p className="text-xs text-muted-foreground">Pesanan selesai</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Shortcut ke halaman terpisah */}
                <div className="grid grid-cols-2 gap-4">
                    <Link to="/queue/food" className="group">
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-100 text-sm font-medium mb-1">Tampilan Khusus</p>
                                    <h3 className="text-2xl font-bold">Antrian Makanan</h3>
                                    <p className="text-orange-100 text-sm mt-2">Buka halaman antrian makanan saja →</p>
                                </div>
                                <div className="bg-white/20 rounded-2xl p-4">
                                    <Utensils className="h-10 w-10" />
                                </div>
                            </div>
                        </div>
                    </Link>
                    <Link to="/queue/drink" className="group">
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 text-white p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm font-medium mb-1">Tampilan Khusus</p>
                                    <h3 className="text-2xl font-bold">Antrian Minuman</h3>
                                    <p className="text-blue-100 text-sm mt-2">Buka halaman antrian minuman saja →</p>
                                </div>
                                <div className="bg-white/20 rounded-2xl p-4">
                                    <Coffee className="h-10 w-10" />
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Queue List - Split Panel: Makanan & Minuman */}
                {orders.length === 0 ? (
                    <Card>
                        <CardContent className="py-12">
                            <div className="text-center">
                                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">Tidak ada pesanan dalam antrian</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ===== PANEL MAKANAN ===== */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-4 py-3 bg-orange-500 text-white rounded-xl shadow">
                                <Utensils className="h-5 w-5" />
                                <h2 className="text-lg font-bold tracking-wide">ANTRIAN MAKANAN</h2>
                                <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {orders.filter(o => {
                                        const isReactivated = !!(o.queue_completed_at && o.queue_status !== 'completed');
                                        const displayItems = isReactivated
                                            ? o.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                            : [...o.items].sort((a,b) => a.id - b.id);
                                        return displayItems.filter(isFoodItem).length > 0;
                                    }).length} pesanan
                                </span>
                            </div>

                            {orders.filter(o => {
                                const isReactivated = !!(o.queue_completed_at && o.queue_status !== 'completed');
                                const displayItems = isReactivated
                                    ? o.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                    : [...o.items].sort((a,b) => a.id - b.id);
                                return displayItems.filter(isFoodItem).length > 0;
                            }).length === 0 ? (
                                <Card className="border-dashed border-orange-300">
                                    <CardContent className="py-10 text-center">
                                        <Utensils className="h-8 w-8 text-orange-300 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">Tidak ada antrian makanan</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {orders.filter(o => {
                                        const isReactivated = !!(o.queue_completed_at && o.queue_status !== 'completed');
                                        const displayItems = isReactivated
                                            ? o.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                            : [...o.items].sort((a,b) => a.id - b.id);
                                        return displayItems.filter(isFoodItem).length > 0;
                                    }).map((order) => {
                                        const isReactivated = !!(order.queue_completed_at && order.queue_status !== 'completed');
                                        const displayItems = isReactivated
                                            ? order.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                            : [...order.items].sort((a,b) => a.id - b.id);
                                        const foodItems = displayItems.filter(isFoodItem);
                                        const hasVisibleAddons = foodItems.some(i => i.is_addon);
                                        const foodCompleted = order.queue_status === 'completed';
                                        const foodHold = order.queue_status === 'hold';
                                        return (
                                            <Card key={`food-${order.id}`} className={`border-2 hover:shadow-lg transition-all ${
                                                foodCompleted
                                                    ? 'border-green-500 bg-green-50/50 dark:bg-green-950/10 opacity-75'
                                                    : foodHold
                                                        ? 'border-yellow-500 bg-yellow-50/80 dark:bg-yellow-950/20 ring-2 ring-yellow-400/40 opacity-90'
                                                        : hasVisibleAddons
                                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 ring-2 ring-purple-500/20'
                                                            : order.queue_status === 'in_progress'
                                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg scale-[1.02]'
                                                                : 'border-orange-400 bg-orange-50 dark:bg-orange-950/20'
                                            }`}>
                                                <CardContent className="p-4">
                                                    {hasVisibleAddons && !foodCompleted && (
                                                        <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs p-2 rounded mb-3 font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-2 animate-pulse">
                                                            <span className="text-lg">🔔</span>
                                                            <div>PESANAN TAMBAHAN<div className="font-normal text-[10px] opacity-90">Ada item baru ditambahkan</div></div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="text-4xl font-bold text-orange-500">#{order.daily_number}</div>
                                                                <div className="flex flex-col gap-1">
                                                                    <Badge variant={order.order_type === 'takeaway' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0.5 h-fit w-fit">
                                                                        {order.order_type === 'takeaway' ? 'Dibungkus' : 'Makan Sini'}
                                                                    </Badge>
                                                                    {hasVisibleAddons && <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit w-fit border-warning text-warning font-bold bg-warning/10 animate-pulse">TAMBAHAN +</Badge>}
                                                                </div>
                                                            </div>
                                                            <h3 className="font-semibold text-sm truncate" title={order.customer_name || 'Pelanggan'}>{order.customer_name || 'Pelanggan'}</h3>
                                                            {order.table && <div className="flex items-center gap-1 mt-1"><Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit w-fit border-primary text-primary font-bold bg-primary/10">🪑 Meja {order.table.table_number}</Badge></div>}
                                                            <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
                                                        </div>
                                                    </div>
                                                    {/* Alasan hold makanan */}
                                                    {foodHold && order.hold_reason && (
                                                        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs p-2 rounded mb-2 font-medium border border-yellow-300 dark:border-yellow-700">
                                                            <span className="font-bold">⏸ Alasan Hold:</span> {order.hold_reason}
                                                        </div>
                                                    )}
                                                    {/* Daftar Makanan */}
                                                    <div className={`mb-2 rounded-lg border-2 overflow-hidden ${ foodCompleted ? 'border-green-400 bg-green-50/70 dark:bg-green-950/20' : foodHold ? 'border-yellow-400 bg-yellow-50/60 dark:bg-yellow-950/10' : 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/10'}`}>
                                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white ${ foodCompleted ? 'bg-green-500' : foodHold ? 'bg-yellow-500' : 'bg-orange-400'}`}>
                                                            <Utensils className="h-3 w-3" />
                                                            <span>MAKANAN</span>
                                                            {foodCompleted && <span className="text-[10px] bg-white/20 px-1 rounded">✓ Selesai</span>}
                                                            {foodHold && <span className="text-[10px] bg-white/20 px-1 rounded">⏸ Ditahan</span>}
                                                        </div>
                                                        <div className="px-3 py-2 space-y-1 max-h-36 overflow-y-auto">
                                                            {foodItems.map(item => (
                                                                <div key={item.id} className={`text-xs ${item.is_addon ? 'bg-purple-100 dark:bg-purple-900/40 p-1 rounded border border-purple-200 dark:border-purple-800' : ''}`}>
                                                                    <span className="font-bold">{item.quantity}x</span> {item.menu_item?.name || 'Item Dihapus'}
                                                                    {item.is_takeaway && <span className="text-destructive font-semibold ml-1">(Bungkus)</span>}
                                                                    {item.is_addon && <span className="text-purple-600 dark:text-purple-400 font-bold ml-1 text-[10px] animate-pulse">● BARU</span>}
                                                                    {item.note && <div className="text-[10px] text-muted-foreground italic pl-4 mt-0.5">- {formatItemNote(item.note, item.menu_item?.name)}</div>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="px-3 pb-2">
                                                            {foodCompleted ? (
                                                                <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-green-700 hover:text-orange-700 hover:bg-orange-100" onClick={() => handleFoodStatusChange(order.id, false)}>
                                                                    <Undo2 className="h-3 w-3 mr-1" /> Batalkan Selesai
                                                                </Button>
                                                            ) : (
                                                                <div className="flex flex-col gap-1">
                                                                    <Button size="sm" className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handleFoodStatusChange(order.id, true)}>
                                                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Makanan Selesai
                                                                    </Button>
                                                                    {canHold && (foodHold ? (
                                                                        <Button size="sm" className="w-full h-7 text-xs bg-red-500 hover:bg-red-600 text-white" onClick={() => handleResume(order.id, "food")}>
                                                                            <RefreshCw className="h-3 w-3 mr-1" /> Lanjutkan Makanan
                                                                        </Button>
                                                                    ) : (
                                                                        <Button size="sm" className="w-full h-7 text-xs bg-red-500 hover:bg-red-600 text-white" onClick={() => { setHoldTarget({ order, type: "food" }); setHoldReason(""); }}>
                                                                            <Clock className="h-3 w-3 mr-1" /> Tahan Makanan
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Notes & Kasir */}
                                                    <div className="border-t pt-2 mt-1">
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">+ Catatan</p>
                                                        {editingNotes === order.id ? (
                                                            <div className="space-y-2">
                                                                <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} placeholder="Catatan tambahan..." rows={2} className="text-xs" />
                                                                <div className="flex gap-1">
                                                                    <Button size="sm" onClick={() => handleNotesUpdate(order.id)} className="text-xs h-7 flex-1">Simpan</Button>
                                                                    <Button size="sm" variant="outline" onClick={() => { setEditingNotes(null); setNotesValue(''); }} className="text-xs h-7 flex-1">Batal</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted text-xs min-h-[2.5rem] max-h-16 overflow-y-auto" onClick={() => { setEditingNotes(order.id); setNotesValue(order.notes || ''); }} title="Klik untuk tambah catatan">
                                                                {order.notes ? <span className="text-foreground">{order.notes}</span> : <span className="text-muted-foreground italic">Klik untuk tambah catatan</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                                        <p className="text-xs text-muted-foreground truncate">Kasir: {order.user.name}</p>
                                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); setEditingOrder(order); setShowEditDialog(true); }} title="Edit pesanan">
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

                        {/* ===== PANEL MINUMAN ===== */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-4 py-3 bg-blue-500 text-white rounded-xl shadow">
                                <Coffee className="h-5 w-5" />
                                <h2 className="text-lg font-bold tracking-wide">ANTRIAN MINUMAN</h2>
                                <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {orders.filter(o => {
                                        const isReactivated = !!(o.queue_completed_at && o.queue_status !== 'completed');
                                        const displayItems = isReactivated
                                            ? o.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                            : [...o.items].sort((a,b) => a.id - b.id);
                                        return displayItems.filter(isDrinkItem).length > 0;
                                    }).length} pesanan
                                </span>
                            </div>

                            {orders.filter(o => {
                                const isReactivated = !!(o.queue_completed_at && o.queue_status !== 'completed');
                                const displayItems = isReactivated
                                    ? o.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                    : [...o.items].sort((a,b) => a.id - b.id);
                                return displayItems.filter(isDrinkItem).length > 0;
                            }).length === 0 ? (
                                <Card className="border-dashed border-blue-300">
                                    <CardContent className="py-10 text-center">
                                        <Coffee className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">Tidak ada antrian minuman</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {orders.filter(o => {
                                        const isReactivated = !!(o.queue_completed_at && o.queue_status !== 'completed');
                                        const displayItems = isReactivated
                                            ? o.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                            : [...o.items].sort((a,b) => a.id - b.id);
                                        return displayItems.filter(isDrinkItem).length > 0;
                                    }).map((order) => {
                                        const isReactivated = !!(order.queue_completed_at && order.queue_status !== 'completed');
                                        const displayItems = isReactivated
                                            ? order.items.filter(i => { if (!i.is_addon) return false; const cat = (i.menu_item?.category || '').toLowerCase(); return ['makanan','minuman'].includes(cat); })
                                            : [...order.items].sort((a,b) => a.id - b.id);
                                        const drinkItems = displayItems.filter(isDrinkItem);
                                        const hasVisibleAddons = drinkItems.some(i => i.is_addon);
                                        const drinkCompleted = order.drink_queue_status === 'completed';
                                        const drinkHold = order.drink_queue_status === 'hold';
                                        return (
                                            <Card key={`drink-${order.id}`} className={`border-2 hover:shadow-lg transition-all ${
                                                drinkCompleted
                                                    ? 'border-green-500 bg-green-50/50 dark:bg-green-950/10 opacity-75'
                                                    : drinkHold
                                                        ? 'border-slate-400 bg-slate-50 dark:bg-slate-900/30 ring-2 ring-slate-400/40 opacity-90'
                                                        : hasVisibleAddons
                                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 ring-2 ring-purple-500/20'
                                                            : 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
                                            }`}>
                                                <CardContent className="p-4">
                                                    {hasVisibleAddons && !drinkCompleted && (
                                                        <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs p-2 rounded mb-3 font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-2 animate-pulse">
                                                            <span className="text-lg">🔔</span>
                                                            <div>PESANAN TAMBAHAN<div className="font-normal text-[10px] opacity-90">Ada item baru ditambahkan</div></div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="text-4xl font-bold text-blue-500">#{order.daily_number}</div>
                                                                <div className="flex flex-col gap-1">
                                                                    <Badge variant={order.order_type === 'takeaway' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0.5 h-fit w-fit">
                                                                        {order.order_type === 'takeaway' ? 'Dibungkus' : 'Makan Sini'}
                                                                    </Badge>
                                                                    {hasVisibleAddons && <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit w-fit border-warning text-warning font-bold bg-warning/10 animate-pulse">TAMBAHAN +</Badge>}
                                                                </div>
                                                            </div>
                                                            <h3 className="font-semibold text-sm truncate" title={order.customer_name || 'Pelanggan'}>{order.customer_name || 'Pelanggan'}</h3>
                                                            {order.table && <div className="flex items-center gap-1 mt-1"><Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit w-fit border-primary text-primary font-bold bg-primary/10">🪑 Meja {order.table.table_number}</Badge></div>}
                                                            <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
                                                        </div>
                                                    </div>
                                                    {/* Alasan hold minuman (terpisah dari makanan) */}
                                                    {drinkHold && order.drink_hold_reason && (
                                                        <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs p-2 rounded mb-2 font-medium border border-slate-300 dark:border-slate-600">
                                                            <span className="font-bold">⏸ Alasan Hold:</span> {order.drink_hold_reason}
                                                        </div>
                                                    )}
                                                    {/* Daftar Minuman */}
                                                    <div className={`mb-2 rounded-lg border-2 overflow-hidden ${ drinkCompleted ? 'border-green-400 bg-green-50/70 dark:bg-green-950/20' : drinkHold ? 'border-slate-400 bg-slate-50/60 dark:bg-slate-900/20' : 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/10'}`}>
                                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white ${ drinkCompleted ? 'bg-green-500' : drinkHold ? 'bg-slate-500' : 'bg-blue-500'}`}>
                                                            <Coffee className="h-3 w-3" />
                                                            <span>MINUMAN</span>
                                                            {drinkCompleted && <span className="text-[10px] bg-white/20 px-1 rounded">✓ Selesai</span>}
                                                            {drinkHold && <span className="text-[10px] bg-white/20 px-1 rounded">⏸ Ditahan</span>}
                                                        </div>
                                                        <div className="px-3 py-2 space-y-1 max-h-36 overflow-y-auto">
                                                            {drinkItems.map(item => (
                                                                <div key={item.id} className={`text-xs ${item.is_addon ? 'bg-purple-100 dark:bg-purple-900/40 p-1 rounded border border-purple-200 dark:border-purple-800' : ''}`}>
                                                                    <span className="font-bold">{item.quantity}x</span> {item.menu_item?.name || 'Item Dihapus'}
                                                                    {item.is_takeaway && <span className="text-destructive font-semibold ml-1">(Bungkus)</span>}
                                                                    {item.is_addon && <span className="text-purple-600 dark:text-purple-400 font-bold ml-1 text-[10px] animate-pulse">● BARU</span>}
                                                                    {item.note && <div className="text-[10px] text-muted-foreground italic pl-4 mt-0.5">- {formatItemNote(item.note, item.menu_item?.name)}</div>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="px-3 pb-2">
                                                            {drinkCompleted ? (
                                                                <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-green-700 hover:text-blue-700 hover:bg-blue-100" onClick={() => handleDrinkStatusChange(order.id, false)}>
                                                                    <Undo2 className="h-3 w-3 mr-1" /> Batalkan Selesai
                                                                </Button>
                                                            ) : (
                                                                <div className="flex flex-col gap-1">
                                                                    <Button size="sm" className="w-full h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white" onClick={() => handleDrinkStatusChange(order.id, true)}>
                                                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Minuman Selesai
                                                                    </Button>
                                                                    {canHold && (drinkHold ? (
                                                                        <Button size="sm" className="w-full h-7 text-xs bg-red-500 hover:bg-red-600 text-white" onClick={() => handleResume(order.id, "drink")}>
                                                                            <RefreshCw className="h-3 w-3 mr-1" /> Lanjutkan Minuman
                                                                        </Button>
                                                                    ) : (
                                                                        <Button size="sm" className="w-full h-7 text-xs bg-red-500 hover:bg-red-600 text-white" onClick={() => { setHoldTarget({ order, type: "drink" }); setHoldReason(""); }}>
                                                                            <Clock className="h-3 w-3 mr-1" /> Tahan Minuman
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Notes & Kasir */}
                                                    <div className="border-t pt-2 mt-1">
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">+ Catatan</p>
                                                        {editingNotes === order.id ? (
                                                            <div className="space-y-2">
                                                                <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} placeholder="Catatan tambahan..." rows={2} className="text-xs" />
                                                                <div className="flex gap-1">
                                                                    <Button size="sm" onClick={() => handleNotesUpdate(order.id)} className="text-xs h-7 flex-1">Simpan</Button>
                                                                    <Button size="sm" variant="outline" onClick={() => { setEditingNotes(null); setNotesValue(''); }} className="text-xs h-7 flex-1">Batal</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted text-xs min-h-[2.5rem] max-h-16 overflow-y-auto" onClick={() => { setEditingNotes(order.id); setNotesValue(order.notes || ''); }} title="Klik untuk tambah catatan">
                                                                {order.notes ? <span className="text-foreground">{order.notes}</span> : <span className="text-muted-foreground italic">Klik untuk tambah catatan</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                                        <p className="text-xs text-muted-foreground truncate">Kasir: {order.user.name}</p>
                                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); setEditingOrder(order); setShowEditDialog(true); }} title="Edit pesanan">
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
                )}
            </div>


            {/* Hold Dialog — makanan & minuman ditahan terpisah */}
            <Dialog open={!!holdTarget} onOpenChange={(open) => !open && setHoldTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Tahan {holdTarget?.type === "food" ? "Makanan" : "Minuman"} #{holdTarget?.order.daily_number}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Hanya bagian {holdTarget?.type === "food" ? "makanan" : "minuman"} yang ditahan — bagian lainnya tetap berjalan di antrian.
                        </p>
                        <Textarea
                            value={holdReason}
                            onChange={(e) => setHoldReason(e.target.value)}
                            placeholder="Alasan menahan pesanan (opsional)..."
                            rows={3}
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setHoldTarget(null)}>Batal</Button>
                        <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleHoldSubmit}>
                            <Clock className="h-4 w-4 mr-1.5" /> Tahan Pesanan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Order Dialog */}
            <EditQueueOrderDialog
                open={showEditDialog}
                onOpenChange={(open) => {
                    setShowEditDialog(open);
                    if (!open) setEditingOrder(null);
                }}
                order={editingOrder}
                onSuccess={() => {
                    // Force re-fetch to get updated data
                    prevOrdersRef.current = [];
                    fetchQueue();
                    fetchStatistics();
                }}
            />
        </MainLayout>
    );
};

export default QueuePage;
