import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency } from '@/utils/calculations';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Filter,
  Eye,
  Printer,
  BarChart3,
  Building2,
  Store as StoreIcon,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Store {
  id: number;
  name: string;
}

export default function ReportsPage() {
  const { user, isKaryawan, isAdmin, canEdit, hasPermission, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<any>(null);

  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    user_id: '',
    store_id: '',
  });

  useEffect(() => {
    if (!authLoading && user && hasPermission('view_reports')) {
      if (isAdmin()) {
        fetchStores();
      }
      // Initialize store_id for admin if stores are loaded?? 
      // Better to handle in fetchStores or let it be empty (all stores? or must select?)
      // User request says "jika admin maka dapat filter toko". implies optional or selectable.

      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Refetch data when filters change
  useEffect(() => {
    if (!loading && hasPermission('view_reports')) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.start_date, filters.end_date, filters.user_id, filters.store_id]);

  // Refetch employees when store_id changes (for Admin)
  useEffect(() => {
    if (canEdit()) {
      fetchEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.store_id]);

  useEffect(() => {
    if (orders.length > 0) {
      processChartData(orders);
    } else {
      setChartData([]);
    }
  }, [chartView, orders]);

  const fetchStores = async () => {
    try {
      const response = await api.get('/stores-management');
      setStores(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const params: any = {
        role: 'karyawan', // Only fetch employees
        position: 'Kasir' // Must have Kasir position
      };

      if (isAdmin() && filters.store_id) {
        params.store_id = filters.store_id;
      }

      const empRes = await api.get('/employees', { params });
      setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const fetchData = async () => {
    try {
      const params: any = {
        start_date: filters.start_date,
        end_date: filters.end_date,
      };

      if (canEdit()) {
        if (filters.user_id && filters.user_id !== 'all') {
          params.user_id = filters.user_id;
        }

        if (isAdmin() && filters.store_id && filters.store_id !== 'all') {
          params.store_id = filters.store_id;
        }
      }

      const [statsRes, ordersRes] = await Promise.all([
        api.get('/orders/report/sales', { params }),
        api.get('/orders', { params }),
      ]);

      setStats(statsRes.data);
      setOrders(ordersRes.data);
      processChartData(ordersRes.data);
    } catch (error: any) {
      console.error('Failed to fetch reports:', error);
      toast.error('Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (ordersData: any[]) => {
    if (!ordersData || ordersData.length === 0) {
      setChartData([]);
      return;
    }

    const grouped: any = {};

    ordersData.forEach((order) => {
      const date = new Date(order.created_at);
      let key = '';

      if (chartView === 'daily') {
        key = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      } else if (chartView === 'monthly') {
        key = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      } else {
        key = date.getFullYear().toString();
      }

      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          pendapatan: 0,
          hpp: 0,
          profit: 0,
          orders: 0,
        };
      }

      // Parse numbers properly
      const total = parseFloat(order.total) || 0;
      const cogs = parseFloat(order.cogs) || 0;
      const profit = parseFloat(order.profit) || 0;

      grouped[key].pendapatan += total;
      grouped[key].hpp += cogs;
      grouped[key].profit += profit;
      grouped[key].orders += 1;
    });

    const chartArray = Object.values(grouped);
    setChartData(chartArray);
  };

  const handleViewOrder = async (orderId: number) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data);
      setShowReceipt(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      toast.error('Gagal memuat detail order');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCancelOrder = (order: any) => {
    setOrderToCancel(order);
    setShowCancelDialog(true);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;

    try {
      await api.delete(`/orders/${orderToCancel.id}`);
      toast.success('Pesanan berhasil dibatalkan dan stok dikembalikan');
      setShowCancelDialog(false);
      setOrderToCancel(null);
      // Refresh data
      fetchData();
    } catch (error: any) {
      console.error('Failed to cancel order:', error);
      toast.error(error.response?.data?.message || 'Gagal membatalkan pesanan');
    }
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p>Memuat laporan...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!hasPermission('view_reports')) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <p className="text-xl text-muted-foreground">Akses Ditolak</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Laporan Penjualan</h1>
          <p className="mt-1 text-muted-foreground">
            {isKaryawan() ? 'Lihat laporan penjualan Anda' : 'Monitor performa penjualan tim'}
          </p>
        </div>

        {/* Filters */}
        <div className="card-elevated p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Filter Laporan</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Store Filter - Only for Admin */}
            {isAdmin() && (
              <div>
                <Label>Toko</Label>
                <Select
                  value={filters.store_id}
                  onValueChange={(val) => setFilters({ ...filters, store_id: val, user_id: 'all' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Semua Toko" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Toko</SelectItem>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                className="input-coffee mt-1"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Tanggal Akhir</Label>
              <Input
                type="date"
                className="input-coffee mt-1"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>

            {/* Cashier Filter */}
            {canEdit() && (
              <div>
                <Label>Kasir</Label>
                <Select
                  value={filters.user_id}
                  onValueChange={(val) => setFilters({ ...filters, user_id: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Semua Kasir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kasir</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Transaksi</p>
                  <p className="text-3xl font-bold mt-1 font-display">{stats.total_orders || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Penjualan</p>
                  <p className="text-2xl font-bold mt-1 font-display text-success">
                    {formatCurrency(stats.total_sales || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-success/10">
                  <DollarSign className="w-6 h-6 text-success" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total HPP</p>
                  <p className="text-2xl font-bold mt-1 font-display text-warning">
                    {formatCurrency(stats.total_cogs || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-warning/10">
                  <TrendingUp className="w-6 h-6 text-warning" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Profit</p>
                  <p className="text-2xl font-bold mt-1 font-display text-success">
                    {formatCurrency(stats.total_profit || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Margin: {(stats.profit_margin || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-success/10">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Chart */}
        {stats && (
          <div className="card-elevated p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-display font-semibold text-lg">Grafik Penjualan</h3>
              </div>

              {/* Chart View Toggle */}
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${chartView === 'daily'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  onClick={() => setChartView('daily')}
                >
                  Harian
                </button>
                <button
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${chartView === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  onClick={() => setChartView('monthly')}
                >
                  Bulanan
                </button>
                <button
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${chartView === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  onClick={() => setChartView('yearly')}
                >
                  Tahunan
                </button>
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={chartView === 'daily' ? -45 : 0}
                    textAnchor={chartView === 'daily' ? 'end' : 'middle'}
                    height={chartView === 'daily' ? 80 : 30}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="pendapatan" fill="#10b981" name="Pendapatan" />
                  <Bar dataKey="hpp" fill="#f59e0b" name="HPP" />
                  <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Tidak ada data transaksi dalam periode ini</p>
                <p className="text-sm mt-1">Silakan ubah filter tanggal atau tambah transaksi baru</p>
              </div>
            )}
          </div>
        )}

        {/* Orders Table */}
        <div className="card-elevated p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Riwayat Transaksi</h3>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada transaksi dalam periode ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold">Tanggal</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold">Pembeli</th>
                    {canEdit() && (
                      <th className="text-left py-3 px-4 text-sm font-semibold">Kasir</th>
                    )}
                    <th className="text-left py-3 px-4 text-sm font-semibold">Pembayaran</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold">Total</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold">HPP</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold">Profit</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4 text-sm font-mono">#{order.id}</td>
                      <td className="py-3 px-4 text-sm">
                        {new Date(order.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm">{order.customer_name || '-'}</td>
                      {canEdit() && (
                        <td className="py-3 px-4 text-sm">{order.user?.name || '-'}</td>
                      )}
                      <td className="py-3 px-4 text-sm">
                        <span className="px-2 py-1 bg-secondary rounded-full text-xs capitalize">
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs capitalize font-medium ${order.status === 'cancelled'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-success/10 text-success'
                          }`}>
                          {order.status === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-warning">
                        {formatCurrency(order.cogs)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-success font-semibold">
                        {formatCurrency(order.profit)}
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary"
                            onClick={() => handleViewOrder(order.id)}
                            title="Lihat & Print Nota"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {order.status !== 'cancelled' && (
                            <button
                              className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                              onClick={() => handleCancelOrder(order)}
                              title="Batalkan Pesanan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Receipt Dialog */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Detail Transaksi</DialogTitle>
            </DialogHeader>

            <div id="receipt-preview" className="p-0">
              {/* Header */}
              <div className="text-center mb-2">
                <div className="flex justify-center mb-1">
                  {selectedOrder?.store?.image ? (
                    <img
                      src={`http://127.0.0.1:8000/storage/${selectedOrder.store.image}`}
                      alt="Store Logo"
                      className="w-12 h-12 object-cover rounded-full"
                    />
                  ) : (
                    <StoreIcon className="w-6 h-6" strokeWidth={1.5} />
                  )}
                </div>
                <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">
                  {selectedOrder?.store?.name || 'KedaiPOS'}
                </h1>
                {selectedOrder?.store?.location && (
                  <p className="text-[10px] text-muted-foreground px-1 leading-tight mt-1">
                    {selectedOrder.store.location}
                  </p>
                )}
              </div>

              {selectedOrder && (
                <>
                  {/* Info */}
                  <div className="text-[10px] mb-2 pb-1 border-b border-dashed border-black">
                    <div className="flex justify-between mb-0.5">
                      <span>#{(selectedOrder as any).daily_number || selectedOrder.id}</span>
                      <span>{new Date(selectedOrder.created_at).toLocaleDateString('id-ID')} {new Date(selectedOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kasir: {selectedOrder.user?.name?.split(' ')[0]}</span>
                      <span className="capitalize">{(selectedOrder as any).order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}</span>
                    </div>
                    {selectedOrder.customer_name && (
                      <div className="mt-0.5 line-clamp-1">Plg: {selectedOrder.customer_name}</div>
                    )}
                    <div className="mt-0.5 font-bold uppercase text-center border-t border-dashed border-black/50 pt-0.5 mt-1">
                      {selectedOrder.status === 'cancelled' ? 'BATAL' : 'LUNAS'}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
                    {selectedOrder.items?.map((item: any, idx: number) => (
                      <div key={idx} className="text-[10px] leading-tight">
                        <div className="font-bold">{item.menu_item.name}</div>
                        <div className="flex justify-between">
                          <span>{item.quantity} x {formatCurrency(item.price)}</span>
                          <span className="font-semibold">{formatCurrency(item.quantity * item.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mb-2 text-[10px] space-y-0.5">
                    <div className="flex justify-between font-bold text-xs">
                      <span>TOTAL</span>
                      <span>{formatCurrency(selectedOrder.total)}</span>
                    </div>
                    {(selectedOrder as any).paid_amount && (
                      <>
                        <div className="flex justify-between">
                          <span>Dibayar</span>
                          <span>{formatCurrency((selectedOrder as any).paid_amount)}</span>
                        </div>
                        {(selectedOrder as any).change_amount && (
                          <div className="flex justify-between font-semibold">
                            <span>Kembalian</span>
                            <span>{formatCurrency((selectedOrder as any).change_amount)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-center text-[10px] pt-1 border-t border-dashed border-black">
                    <p className="font-semibold mb-0.5">Terima Kasih</p>
                    <p className="text-[9px] leading-none">Powered by KedaiPOS</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                className="btn-outline flex-1"
                onClick={() => setShowReceipt(false)}
              >
                Tutup
              </button>
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Order Confirmation Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Batalkan Pesanan?</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Apakah Anda yakin ingin membatalkan pesanan ini?
              </p>
              {orderToCancel && (
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ID Pesanan:</span>
                    <span className="font-mono font-semibold">#{orderToCancel.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{formatCurrency(orderToCancel.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tanggal:</span>
                    <span>{new Date(orderToCancel.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-warning mt-4">
                ⚠️ Stok inventory akan dikembalikan setelah pembatalan.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                className="btn-outline flex-1"
                onClick={() => {
                  setShowCancelDialog(false);
                  setOrderToCancel(null);
                }}
              >
                Batal
              </button>
              <button
                className="btn-destructive flex-1 flex items-center justify-center gap-2"
                onClick={confirmCancelOrder}
              >
                <Trash2 className="w-4 h-4" />
                Batalkan Pesanan
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hidden Print Receipt - Outside Dialog */}
        <div id="receipt-print" className="hidden">
          {selectedOrder && (
            <div className="p-0">
              <div className="text-center mb-2">
                <div className="flex justify-center mb-1">
                  {selectedOrder.store?.image ? (
                    <img
                      src={`http://127.0.0.1:8000/storage/${selectedOrder.store.image}`}
                      alt="Store Logo"
                      className="w-12 h-12 object-cover rounded-full"
                    />
                  ) : (
                    <StoreIcon className="w-6 h-6" strokeWidth={1.5} />
                  )}
                </div>
                <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">
                  {selectedOrder.store?.name || 'KedaiPOS'}
                </h1>
                {selectedOrder.store?.location && (
                  <p className="text-[10px] text-muted-foreground px-1 leading-tight mt-1">
                    {selectedOrder.store.location}
                  </p>
                )}
              </div>

              <div className="text-[10px] mb-2 pb-1 border-b border-dashed border-black">
                <div className="flex justify-between mb-0.5">
                  <span>#{(selectedOrder as any).daily_number || selectedOrder.id}</span>
                  <span>{new Date(selectedOrder.created_at).toLocaleDateString('id-ID')} {new Date(selectedOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir: {selectedOrder.user?.name?.split(' ')[0]}</span>
                  <span className="capitalize">{(selectedOrder as any).order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}</span>
                </div>
                {selectedOrder.customer_name && (
                  <div className="mt-0.5 line-clamp-1">Plg: {selectedOrder.customer_name}</div>
                )}
                <div className="mt-0.5 font-bold uppercase text-center border-t border-dashed border-black/50 pt-0.5 mt-1">
                  {selectedOrder.status === 'cancelled' ? 'BATAL' : 'LUNAS'}
                </div>
              </div>

              <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="text-[10px] leading-tight">
                    <div className="font-bold">{item.menu_item.name}</div>
                    <div className="flex justify-between">
                      <span>{item.quantity} x {formatCurrency(item.price)}</span>
                      <span className="font-semibold">{formatCurrency(item.quantity * item.price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-2 text-[10px] space-y-0.5">
                <div className="flex justify-between font-bold text-xs">
                  <span>TOTAL</span>
                  <span>{formatCurrency(selectedOrder.total)}</span>
                </div>
                {(selectedOrder as any).paid_amount && (
                  <>
                    <div className="flex justify-between">
                      <span>Dibayar</span>
                      <span>{formatCurrency((selectedOrder as any).paid_amount)}</span>
                    </div>
                    {(selectedOrder as any).change_amount && (
                      <div className="flex justify-between font-semibold">
                        <span>Kembalian</span>
                        <span>{formatCurrency((selectedOrder as any).change_amount)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="text-center text-[10px] pt-1 border-t border-dashed border-black">
                <p className="font-semibold mb-0.5">Terima Kasih</p>
                <p className="text-[9px] leading-none">Powered by KedaiPOS</p>
              </div>
            </div>
          )}
        </div>

        {/* Print Styles */}
        <style>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0mm;
          }
          
          html, body {
            margin: 0;
            padding: 0;
          }
          
          body * {
            visibility: hidden;
            height: 0;
          }
          
          #receipt-print,
          #receipt-print * {
            visibility: visible;
            height: auto;
          }
          
          #receipt-print {
            display: block !important;
            position: fixed;
            left: 0;
            top: 0;
            width: 58mm; /* Full paper width */
            padding: 0 6mm 5mm 6mm; /* 6mm safe margin on sides */
            margin: 0;
            z-index: 9999;
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
            font-size: 10px;
            line-height: 1.2;
            color: black;
            background: white;
          }

          #receipt-print h1 {
            font-size: 14px;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000 !important;
          }
          
          .text-muted-foreground {
              color: #000 !important;
          }
        }
        
        #receipt-preview {
             font-family: 'Arial', sans-serif;
             border: 1px solid #eee;
        }
        `}</style>
      </div>
    </MainLayout>
  );
}
