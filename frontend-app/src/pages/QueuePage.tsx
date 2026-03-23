import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, CheckCircle2, Clock, Package, Undo2, Utensils, Coffee, Pencil } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EditQueueOrderDialog } from "@/components/EditQueueOrderDialog";

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
    queue_status: "pending" | "in_progress" | "completed";
    drink_queue_status: "pending" | "completed";
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
    const prevOrdersRef = useRef<QueueOrder[]>([]);
    const [editingOrder, setEditingOrder] = useState<QueueOrder | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);

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
                        const statusPriority = { in_progress: 0, pending: 1, completed: 2 };
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
    const speakOrderCompleted = (customerName: string, isTakeaway: boolean) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const actionText = isTakeaway ? "Dibungkus" : "Makan Sini";
            const textToSpeak = `Pesanan atas nama ${customerName}, ${actionText}`;
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
                    speakOrderCompleted(order.customer_name, order.order_type === 'takeaway');
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

                {/* Queue List - Grid Layout */}
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
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {orders.map((order) => {
                            const addonItems = order.items.filter(i => i.is_addon);
                            const hasAddons = addonItems.length > 0;

                            const isReactivated = order.queue_completed_at && order.queue_status !== "completed";

                            const displayItems = isReactivated
                                ? order.items.filter(i => {
                                    if (!i.is_addon) return false;
                                    const cat = (i.menu_item?.category || "").toLowerCase();
                                    return ["makanan", "minuman"].includes(cat);
                                })
                                : [...order.items].sort((a, b) => a.id - b.id);

                            const hasVisibleAddons = displayItems.some(i => i.is_addon);

                            if (isReactivated && displayItems.length === 0) return null;

                            // Pisahkan item display menjadi makanan dan minuman
                            const foodItems = displayItems.filter(isFoodItem);
                            const drinkItems = displayItems.filter(isDrinkItem);

                            const hasFoodItems = foodItems.length > 0;
                            const hasDrinkItems = drinkItems.length > 0;

                            const foodCompleted = order.queue_status === "completed";
                            const drinkCompleted = order.drink_queue_status === "completed";

                            return (
                                <Card
                                    key={order.id}
                                    className={`border-2 hover:shadow-lg transition-all ${foodCompleted && drinkCompleted
                                        ? "border-green-500 bg-green-50/50 dark:bg-green-950/10 opacity-75 grayscale-[0.5]"
                                        : hasVisibleAddons
                                            ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20 shadow-md shadow-purple-100 ring-2 ring-purple-500/20"
                                            : order.queue_status === "in_progress"
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg scale-[1.02]"
                                                : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                                        }`}
                                >
                                    <CardContent className="p-4">
                                        {/* Banner Keterangan utk Addon */}
                                        {hasVisibleAddons && order.queue_status !== "completed" && (
                                            <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs p-2 rounded mb-3 font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-2 animate-pulse">
                                                <span className="text-lg">🔔</span>
                                                <div>
                                                    PESANAN TAMBAHAN
                                                    <div className="font-normal text-[10px] opacity-90">
                                                        {isReactivated
                                                            ? "Pesanan baru untuk meja ini (Re-Order)"
                                                            : "Ada item baru ditambahkan ke antrian ini"}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Header dengan Nomor Antrian */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="text-4xl font-bold text-primary">
                                                        #{order.daily_number}
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={order.order_type === 'takeaway' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0.5 h-fit w-fit">
                                                            {order.order_type === 'takeaway' ? 'Dibungkus' : 'Makan Sini'}
                                                        </Badge>
                                                        {hasVisibleAddons && (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit w-fit border-warning text-warning font-bold bg-warning/10 animate-pulse">
                                                                TAMBAHAN +
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <h3 className="font-semibold text-sm truncate" title={order.customer_name || "Pelanggan"}>
                                                    {order.customer_name || "Pelanggan"}
                                                </h3>
                                                {order.table && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit w-fit border-primary text-primary font-bold bg-primary/10">
                                                            🪑 Meja {order.table.table_number}
                                                        </Badge>
                                                    </div>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    {formatTime(order.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* ===== SEKSI MAKANAN ===== */}
                                        {hasFoodItems && (
                                            <div className={`mb-2 rounded-lg border-2 overflow-hidden ${foodCompleted
                                                ? "border-green-400 bg-green-50/70 dark:bg-green-950/20"
                                                : "border-orange-300 bg-orange-50/50 dark:bg-orange-950/10"
                                                }`}>
                                                {/* Header Makanan */}
                                                <div className={`flex items-center justify-between px-3 py-1.5 ${foodCompleted
                                                    ? "bg-green-500 text-white"
                                                    : "bg-orange-400 text-white"
                                                    }`}>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                                        <Utensils className="h-3 w-3" />
                                                        <span>MAKANAN</span>
                                                        {foodCompleted && <span className="text-[10px] bg-white/20 px-1 rounded">✓ Selesai</span>}
                                                    </div>
                                                </div>

                                                {/* Daftar Item Makanan */}
                                                <div className="px-3 py-2 space-y-1 max-h-28 overflow-y-auto">
                                                    {foodItems.map((item) => (
                                                        <div key={item.id} className={`text-xs ${item.is_addon ? 'bg-purple-100 dark:bg-purple-900/40 p-1 rounded border border-purple-200 dark:border-purple-800' : ''}`}>
                                                            <div className="flex justify-between">
                                                                <span className="truncate flex-1 pr-2" title={item.menu_item?.name || "Item Dihapus"}>
                                                                    <span className="font-bold">{item.quantity}x</span> {item.menu_item?.name || "Item Dihapus"}
                                                                    {item.is_takeaway && <span className="text-destructive font-semibold ml-1">(Bungkus)</span>}
                                                                    {item.is_addon && <span className="text-purple-600 dark:text-purple-400 font-bold ml-1 text-[10px] animate-pulse">● BARU</span>}
                                                                </span>
                                                            </div>
                                                            {item.note && (
                                                                <div className="text-[10px] text-muted-foreground italic pl-4 mt-0.5">
                                                                    - {item.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Tombol Selesai Makanan */}
                                                <div className="px-3 pb-2">
                                                    {foodCompleted ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="w-full h-7 text-xs text-green-700 hover:text-orange-700 hover:bg-orange-100"
                                                            onClick={() => handleFoodStatusChange(order.id, false)}
                                                        >
                                                            <Undo2 className="h-3 w-3 mr-1" />
                                                            Batalkan Selesai Makanan
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                                                            onClick={() => handleFoodStatusChange(order.id, true)}
                                                        >
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            Makanan Selesai
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* ===== SEKSI MINUMAN ===== */}
                                        {hasDrinkItems && (
                                            <div className={`mb-2 rounded-lg border-2 overflow-hidden ${drinkCompleted
                                                ? "border-green-400 bg-green-50/70 dark:bg-green-950/20"
                                                : "border-blue-300 bg-blue-50/50 dark:bg-blue-950/10"
                                                }`}>
                                                {/* Header Minuman */}
                                                <div className={`flex items-center justify-between px-3 py-1.5 ${drinkCompleted
                                                    ? "bg-green-500 text-white"
                                                    : "bg-blue-500 text-white"
                                                    }`}>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                                        <Coffee className="h-3 w-3" />
                                                        <span>MINUMAN</span>
                                                        {drinkCompleted && <span className="text-[10px] bg-white/20 px-1 rounded">✓ Selesai</span>}
                                                    </div>
                                                </div>

                                                {/* Daftar Item Minuman */}
                                                <div className="px-3 py-2 space-y-1 max-h-28 overflow-y-auto">
                                                    {drinkItems.map((item) => (
                                                        <div key={item.id} className={`text-xs ${item.is_addon ? 'bg-purple-100 dark:bg-purple-900/40 p-1 rounded border border-purple-200 dark:border-purple-800' : ''}`}>
                                                            <div className="flex justify-between">
                                                                <span className="truncate flex-1 pr-2" title={item.menu_item?.name || "Item Dihapus"}>
                                                                    <span className="font-bold">{item.quantity}x</span> {item.menu_item?.name || "Item Dihapus"}
                                                                    {item.is_takeaway && <span className="text-destructive font-semibold ml-1">(Bungkus)</span>}
                                                                    {item.is_addon && <span className="text-purple-600 dark:text-purple-400 font-bold ml-1 text-[10px] animate-pulse">● BARU</span>}
                                                                </span>
                                                            </div>
                                                            {item.note && (
                                                                <div className="text-[10px] text-muted-foreground italic pl-4 mt-0.5">
                                                                    - {item.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Tombol Selesai Minuman */}
                                                <div className="px-3 pb-2">
                                                    {drinkCompleted ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="w-full h-7 text-xs text-green-700 hover:text-blue-700 hover:bg-blue-100"
                                                            onClick={() => handleDrinkStatusChange(order.id, false)}
                                                        >
                                                            <Undo2 className="h-3 w-3 mr-1" />
                                                            Batalkan Selesai Minuman
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            className="w-full h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white"
                                                            onClick={() => handleDrinkStatusChange(order.id, true)}
                                                        >
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            Minuman Selesai
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Fallback jika tidak ada item yang terkategorisasi (tampilkan semua) */}
                                        {!hasFoodItems && !hasDrinkItems && (
                                            <div className="mb-2 border-t pt-2">
                                                <p className="text-xs font-semibold text-muted-foreground mb-1">Pesanan:</p>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {displayItems.map((item) => (
                                                        <div key={item.id} className={`text-xs ${item.is_addon ? 'bg-purple-100 dark:bg-purple-900/40 p-1 rounded -mx-1 border border-purple-200 dark:border-purple-800' : ''}`}>
                                                            <div className="flex justify-between">
                                                                <span className="truncate flex-1 pr-2">
                                                                    <span className="font-bold">{item.quantity}x</span> {item.menu_item?.name || "Item Dihapus"}
                                                                </span>
                                                            </div>
                                                            {item.note && (
                                                                <div className="text-[10px] text-muted-foreground italic pl-4 mt-0.5">
                                                                    - {item.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Tombol untuk item tanpa kategori (pakai food status) */}
                                                <div className="mt-2">
                                                    {foodCompleted ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="w-full h-7 text-xs"
                                                            onClick={() => handleFoodStatusChange(order.id, false)}
                                                        >
                                                            <Undo2 className="h-3 w-3 mr-1" />
                                                            Rollback ke antrian
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            className="w-full h-7 text-xs"
                                                            onClick={() => handleFoodStatusChange(order.id, true)}
                                                        >
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            Selesai
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Total */}
                                        <div className="mt-1 pt-2 border-t">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-semibold">Total Tagihan:</span>
                                                <span className="text-sm font-bold text-primary">
                                                    {formatCurrency(order.total)}
                                                </span>
                                            </div>
                                            {(order.paid_amount || 0) > 0 && order.payment_status === 'pending' && (
                                                <>
                                                    <div className="flex justify-between items-center text-muted-foreground mt-1">
                                                        <span className="text-[10px]">Telah Dibayar{order.payment_method ? ` (${order.payment_method})` : ''}:</span>
                                                        <span className="text-[10px]">- {formatCurrency(((order.paid_amount || 0) + (order.second_paid_amount || 0)) - (order.change_amount || 0))}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-1 border-t border-dashed pt-1">
                                                        <span className="text-xs font-bold text-orange-600">Sisa Bayar:</span>
                                                        <span className="text-sm font-bold text-orange-600">
                                                            {formatCurrency(Math.max(0, order.total - (((order.paid_amount || 0) + (order.second_paid_amount || 0)) - (order.change_amount || 0))))}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            {(order.paid_amount || 0) > 0 && order.payment_status === 'paid' && (
                                                <div className="mt-1 text-center">
                                                    <Badge className="bg-green-500 hover:bg-green-600 text-[10px] py-0">LUNAS</Badge>
                                                </div>
                                            )}
                                        </div>

                                        {/* Notes Section - Catatan */}
                                        <div className="border-t pt-2 mt-2">
                                            <p className="text-xs font-semibold text-muted-foreground mb-1">+ Catatan</p>
                                            {editingNotes === order.id ? (
                                                <div className="space-y-2">
                                                    <Textarea
                                                        value={notesValue}
                                                        onChange={(e) => setNotesValue(e.target.value)}
                                                        placeholder="Catatan tambahan..."
                                                        rows={2}
                                                        className="text-xs"
                                                    />
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleNotesUpdate(order.id)}
                                                            className="text-xs h-7 flex-1"
                                                        >
                                                            Simpan
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setEditingNotes(null);
                                                                setNotesValue("");
                                                            }}
                                                            className="text-xs h-7 flex-1"
                                                        >
                                                            Batal
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted text-xs min-h-[3rem] max-h-20 overflow-y-auto"
                                                    onClick={() => {
                                                        setEditingNotes(order.id);
                                                        setNotesValue(order.notes || "");
                                                    }}
                                                    title="Klik untuk tambah catatan"
                                                >
                                                    {order.notes ? (
                                                        <span className="text-foreground">{order.notes}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">
                                                            Klik untuk tambah catatan
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Kasir Info + Edit Button */}
                                        <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground truncate" title={`Kasir: ${order.user.name}`}>
                                                Kasir: {order.user.name}
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingOrder(order);
                                                    setShowEditDialog(true);
                                                }}
                                                title="Edit pesanan"
                                            >
                                                <Pencil className="h-3 w-3" />
                                                Edit
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

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
