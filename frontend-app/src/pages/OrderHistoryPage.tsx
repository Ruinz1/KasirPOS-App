import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
    CheckCircle2,
    XCircle,
    DollarSign,
    ShoppingCart,
    Calendar,
    ChevronDown,
    ChevronUp,
    Volume2,
    Undo2
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface OrderItem {
    id: number;
    menu_item_id: number;
    quantity: number;
    price: number;
    note: string | null;
    is_takeaway?: boolean;
    menu_item: {
        id: number;
        name: string;
        price: number;
    } | null;
}

interface HistoryOrder {
    id: number;
    daily_number: number;
    customer_name: string;
    total: number;
    status: string;
    queue_status: string | null;
    created_at: string;
    order_type?: "dine_in" | "takeaway";
    items: OrderItem[];
    user: {
        id: number;
        name: string;
    };
    payment_method: string;
}

interface Statistics {
    completed: number;
    cancelled: number;
    total_revenue: number;
    total_orders: number;
}

const OrderHistoryPage = () => {
    const [orders, setOrders] = useState<HistoryOrder[]>([]);
    const [statistics, setStatistics] = useState<Statistics>({
        completed: 0,
        cancelled: 0,
        total_revenue: 0,
        total_orders: 0,
    });
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
    const { toast } = useToast();

    const fetchOrders = async () => {
        try {
            const params = new URLSearchParams({
                date: selectedDate,
                status: statusFilter,
            });

            const response = await api.get(`/order-history?${params}`);
            setOrders(response.data);
        } catch (error) {
            console.error("Error fetching orders:", error);
            toast({
                title: "Error",
                description: "Gagal memuat riwayat pesanan",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const params = new URLSearchParams({
                date: selectedDate,
            });

            const response = await api.get(`/order-history/statistics?${params}`);
            setStatistics(response.data);
        } catch (error) {
            console.error("Error fetching statistics:", error);
        }
    };

    useEffect(() => {
        fetchOrders();
        fetchStatistics();
    }, [selectedDate, statusFilter]);

    // TTS Logic
    const speakOrderCompleted = (customerName: string, isTakeaway: boolean) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance();
            if (isTakeaway) {
                utterance.text = `Pesanan atas nama ${customerName}, selesai. Silakan diambil.`;
            } else {
                utterance.text = `Pesanan atas nama ${customerName}, selesai. Terima kasih telah memesan di Bakso Bento Malang.`;
            }
            utterance.lang = 'id-ID';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            const voices = window.speechSynthesis.getVoices();
            const indoVoice = voices.find(v => v.lang.includes('id'));
            if (indoVoice) utterance.voice = indoVoice;
            window.speechSynthesis.speak(utterance);
        }
    };

    const toggleOrderExpand = (orderId: number) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    const handleRevertToQueue = async (orderId: number) => {
        try {
            await api.post(`/queue/${orderId}/revert`);
            toast({
                title: "Berhasil",
                description: "Pesanan dikembalikan ke antrian",
                className: "bg-green-600 text-white border-none",
            });
            fetchOrders();
            fetchStatistics();
        } catch (error) {
            console.error("Error reverting order:", error);
            toast({
                title: "Error",
                description: "Gagal mengembalikan pesanan ke antrian",
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Memuat riwayat...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-8 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-display font-bold">Riwayat Pesanan</h1>
                    <p className="text-muted-foreground">
                        Rekap pesanan yang selesai dan dibatalkan
                    </p>
                </div>

                {/* Filters */}
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block">Tanggal</label>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="max-w-xs"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block">Status</label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="max-w-xs">
                                <SelectValue placeholder="Pilih status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                <SelectItem value="completed">Selesai</SelectItem>
                                <SelectItem value="cancelled">Dibatalkan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={() => { fetchOrders(); fetchStatistics(); }} variant="outline">
                        Refresh
                    </Button>
                </div>

                {/* Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Pesanan</CardTitle>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.total_orders}</div>
                            <p className="text-xs text-muted-foreground">Pesanan hari ini</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Selesai</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.completed}</div>
                            <p className="text-xs text-muted-foreground">Pesanan berhasil</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Dibatalkan</CardTitle>
                            <XCircle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.cancelled}</div>
                            <p className="text-xs text-muted-foreground">Pesanan batal</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                            <DollarSign className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(statistics.total_revenue)}</div>
                            <p className="text-xs text-muted-foreground">Dari pesanan selesai</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Orders List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Pesanan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {orders.length === 0 ? (
                            <div className="text-center py-12">
                                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">Tidak ada pesanan pada tanggal ini</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orders.map((order) => (
                                    <Card
                                        key={order.id}
                                        className={`${order.status === "cancelled"
                                            ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                                            : "border-green-200 bg-green-50 dark:bg-green-950/20"
                                            }`}
                                    >
                                        <CardContent className="p-4">
                                            {/* Order Header */}
                                            <div className="flex items-center justify-between">
                                                <div
                                                    className="flex items-center gap-4 flex-1 cursor-pointer"
                                                    onClick={() => toggleOrderExpand(order.id)}
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold">#{order.daily_number}</span>
                                                            <Badge
                                                                variant={order.status === "cancelled" ? "destructive" : "default"}
                                                                className={order.status === "cancelled" ? "" : "bg-green-500"}
                                                            >
                                                                {order.status === "cancelled" ? "Dibatalkan" : "Selesai"}
                                                            </Badge>
                                                            {order.order_type && (
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {order.order_type === 'takeaway' ? 'Bungkus' : 'Makan Sini'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {order.customer_name || "Pelanggan"} • {formatTime(order.created_at)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                                                        <p className="text-xs text-muted-foreground">{order.payment_method}</p>
                                                    </div>

                                                    {/* TTS Replay Button */}
                                                    {order.status !== 'cancelled' && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                speakOrderCompleted(order.customer_name, order.order_type === 'takeaway');
                                                            }}
                                                            title="Panggil Ulang (TTS)"
                                                        >
                                                            <Volume2 className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    <div onClick={() => toggleOrderExpand(order.id)} className="cursor-pointer">
                                                        {expandedOrders.has(order.id) ? (
                                                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Order Details (Expanded) */}
                                            {expandedOrders.has(order.id) && (
                                                <div className="mt-4 pt-4 border-t space-y-3">
                                                    {/* Items */}
                                                    <div>
                                                        <p className="text-sm font-semibold mb-2">Detail Pesanan:</p>
                                                        <div className="space-y-1">
                                                            {order.items.map((item) => (
                                                                <div key={item.id} className="text-sm">
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {item.quantity}x {item.menu_item?.name || "Item Dihapus"}
                                                                            {item.is_takeaway && <span className="text-destructive font-semibold ml-1">(Bungkus)</span>}
                                                                        </span>
                                                                        <span className="font-medium">
                                                                            {formatCurrency(item.price * item.quantity)}
                                                                        </span>
                                                                    </div>
                                                                    {item.note && (
                                                                        <div className="text-xs text-muted-foreground italic pl-4">
                                                                            - {item.note}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Footer Info */}
                                                    <div className="flex justify-between items-center pt-3 border-t text-sm text-muted-foreground">
                                                        <span>Kasir: {order.user.name}</span>
                                                        <div className="flex items-center gap-4">
                                                            {order.status !== 'cancelled' && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    className="h-8 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRevertToQueue(order.id);
                                                                    }}
                                                                >
                                                                    <Undo2 className="h-3 w-3 mr-1" />
                                                                    Kembali ke Antrian
                                                                </Button>
                                                            )}
                                                            <span>{formatDate(order.created_at)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
};

export default OrderHistoryPage;
