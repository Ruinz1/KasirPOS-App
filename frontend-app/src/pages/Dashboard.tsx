import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency, formatNumber } from '@/utils/calculations';
import { useThemeColor } from '@/hooks/use-theme-color';
import { StatCardsSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Package,
  AlertTriangle,
  Coffee,
  Users,
  Store as StoreIcon,
  BarChart3,
  PieChart
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  Cell
} from 'recharts';

interface DashboardStats {
  total_orders_today: number;
  total_sales_today: number;
  total_profit_today: number;
  total_orders_month: number;
  total_sales_month: number;
  total_profit_month: number;
  low_stock_items: number;
  total_employees: number;
  total_stores?: number;
}

interface LowStockItem {
  id: number;
  name: string;
  current_stock: number;
  min_stock: number;
  unit: string;
}

interface RecentOrder {
  id: number;
  customer_name: string;
  total: number;
  created_at: string;
  user: {
    name: string;
  };
}

interface Store {
  id: number;
  name: string;
}

interface SalesChartData {
  name: string;
  total: number;
}

interface PopularMenuData {
  name: string;
  profit: number;
  sales: number;
}

interface HourlyBucket {
  hour: number;
  orders: number;
  revenue: number;
}

interface HeatmapData {
  heatmap: HourlyBucket[];
  max_orders: number;
  days: number;
  total_days_orders: number;
}

// ─── Heatmap Cell Component ──────────────────────────────────────────────────
const HeatmapCell = ({
  bucket,
  maxOrders,
  themeColor,
}: {
  bucket: HourlyBucket;
  maxOrders: number;
  themeColor: string;
}) => {
  const intensity = maxOrders > 0 ? bucket.orders / maxOrders : 0;

  const getBgStyle = (): React.CSSProperties => {
    if (intensity === 0) return { backgroundColor: 'transparent', border: '1px solid rgba(128,128,128,0.15)' };
    const opacity = 0.08 + intensity * 0.87;
    return { backgroundColor: themeColor, opacity };
  };

  const label = bucket.hour === 0 ? '12am'
    : bucket.hour < 12 ? `${bucket.hour}am`
    : bucket.hour === 12 ? '12pm'
    : `${bucket.hour - 12}pm`;

  return (
    <div className="relative group flex flex-col items-center">
      <div
        className="w-full rounded-md cursor-default transition-transform duration-100 group-hover:scale-110"
        style={{ height: '36px', ...getBgStyle() }}
        title={`${label}: ${bucket.orders} pesanan`}
      />
      {/* Tooltip */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 hidden group-hover:flex flex-col items-center pointer-events-none">
        <div className="bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
          <div className="font-bold">{label}</div>
          <div>{bucket.orders} pesanan</div>
          {bucket.orders > 0 && (
            <div className="opacity-70">{formatCurrency(bucket.revenue)}</div>
          )}
        </div>
        <div className="border-4 border-transparent border-t-gray-900" />
      </div>
      {/* Hour label */}
      <span className="text-[9px] text-muted-foreground mt-1 tabular-nums leading-none">{label}</span>
    </div>
  );
};

interface DashboardData {
  stats: DashboardStats;
  recentOrders: RecentOrder[];
  salesData: SalesChartData[];
  popularMenuData: PopularMenuData[];
  lowStockItems: LowStockItem[];
}

export default function Dashboard() {
  const { user, isKaryawan, canEdit, isAdmin } = useAuth();
  const themeColor = useThemeColor();

  const [heatmapDays, setHeatmapDays] = useState<'7' | '14' | '30'>('7');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

  // Daftar toko (khusus admin) — di-cache 5 menit
  const { data: storesData } = useQuery<Store[]>({
    queryKey: ['dashboard-stores'],
    queryFn: async () => (await api.get('/stores-management')).data.data || [],
    enabled: isAdmin(),
    staleTime: 1000 * 60 * 5,
  });
  const stores = storesData ?? [];

  // Heatmap jam sibuk — refetch di background saat periode/toko berubah
  const { data: heatmapData, isFetching: heatmapLoading } = useQuery<HeatmapData>({
    queryKey: ['dashboard-heatmap', heatmapDays, selectedStoreId],
    queryFn: async () => {
      const params: Record<string, string> = { days: heatmapDays };
      if (isAdmin() && selectedStoreId !== 'all') {
        params.store_id = selectedStoreId;
      }
      return (await api.get('/orders/report/hourly-heatmap', { params })).data;
    },
    placeholderData: keepPreviousData,
  });

  // Data utama dashboard — di-cache per toko, refetch otomatis saat tab kembali fokus
  const { data: dashboard, isLoading: loading } = useQuery<DashboardData>({
    queryKey: ['dashboard', selectedStoreId],
    queryFn: () => fetchDashboardData(),
    placeholderData: keepPreviousData,
    refetchInterval: 1000 * 60 * 2, // segarkan tiap 2 menit di background
  });

  const stats = dashboard?.stats ?? null;
  const lowStockItems = dashboard?.lowStockItems ?? [];
  const recentOrders = dashboard?.recentOrders ?? [];
  const salesData = dashboard?.salesData ?? [];
  const popularMenuData = dashboard?.popularMenuData ?? [];

  const fetchDashboardData = async (): Promise<DashboardData> => {
    {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Base params
      const baseParams: any = {};

      // Apply Store Filter for Admin
      if (isAdmin() && selectedStoreId !== 'all') {
        baseParams.store_id = selectedStoreId;
      }

      // Fetch today's stats
      const todayParams = { ...baseParams, start_date: today, end_date: today };
      const monthParams = { ...baseParams, start_date: firstDayOfMonth, end_date: today };

      // Parallel requests for orders
      const [todayStats, monthStats, ordersRes] = await Promise.all([
        api.get('/orders/report/sales', { params: todayParams }),
        api.get('/orders/report/sales', { params: monthParams }),
        api.get('/orders', { params: { ...todayParams, limit: 5 } }),
      ]);

      const dashStats: DashboardStats = {
        total_orders_today: todayStats.data.total_orders,
        total_sales_today: todayStats.data.total_sales,
        total_profit_today: todayStats.data.total_profit,
        total_orders_month: monthStats.data.total_orders,
        total_sales_month: monthStats.data.total_sales,
        total_profit_month: monthStats.data.total_profit,
        low_stock_items: 0,
        total_employees: 0,
      };

      if (isAdmin() && selectedStoreId === 'all') {
        dashStats.total_stores = stores.length;
      }

      const recentOrdersData: RecentOrder[] = ordersRes.data.slice(0, 5);
      let lowStockList: LowStockItem[] = [];
      let salesTrend: SalesChartData[] = [];
      let popularMenu: PopularMenuData[] = [];

      // Fetch Inventory & Employees separately for better error handling
      if (canEdit()) {
        try {
          const inventoryRes = await api.get('/inventory', { params: { ...baseParams, type: 'stock' } });
          const lowStock = inventoryRes.data.filter((item: any) => item.is_low_stock);
          lowStockList = lowStock;
          dashStats.low_stock_items = lowStock.length;
        } catch (error) {
          console.error('Failed to fetch inventory:', error);
        }

        try {
          const empRes = await api.get('/employees', { params: baseParams });
          // Ensure empRes.data is an array
          if (Array.isArray(empRes.data)) {
            dashStats.total_employees = empRes.data.length;
          } else {
            dashStats.total_employees = 0;
          }
        } catch (error) {
          console.error('Failed to fetch employees:', error);
          dashStats.total_employees = 0;
        }
      }

      // --- Chart Data Processing ---
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const chartParams = { ...baseParams, start_date: sevenDaysAgo.toISOString().split('T')[0], end_date: today };

      try {
        const chartOrdersRes = await api.get('/orders', { params: chartParams });
        const chartOrders = chartOrdersRes.data;

        // 1. Sales Trend (Daily)
        const salesTrendDisplay: { name: string; total: number; date: Date }[] = [];

        // Initialize last 7 days including today
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          salesTrendDisplay.push({
            name: d.toLocaleDateString('id-ID', { weekday: 'short' }),
            total: 0,
            date: d 
          });
        }

        chartOrders.forEach((o: any) => {
          if (o.status === 'cancelled') return;
          const d = new Date(o.created_at);
          const matchingEntry = salesTrendDisplay.find(entry =>
            entry.date.getDate() === d.getDate() &&
            entry.date.getMonth() === d.getMonth() &&
            entry.date.getFullYear() === d.getFullYear()
          );

          if (matchingEntry) {
            const total = parseFloat(o.total) || 0;
            matchingEntry.total += total;
          }
        });

        salesTrend = salesTrendDisplay.map(({ name, total }) => ({ name, total }));

        // 2. Popular Menu (Profit Based)
        const menuStats: Record<string, { profit: number, sales: number }> = {};
        chartOrders.forEach((o: any) => {
          if (o.status === 'cancelled') return;
          o.items.forEach((item: any) => {
            if (!item.menu_item) return;
            const menuName = item.menu_item.name;
            if (!menuStats[menuName]) {
              menuStats[menuName] = { profit: 0, sales: 0 };
            }
            const itemTotal = item.price * item.quantity;
            menuStats[menuName].sales += itemTotal;
          });
        });

        popularMenu = Object.entries(menuStats)
          .map(([name, stat]) => ({ name, ...stat }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5);

      } catch (e) {
        console.error("Chart data error", e);
      }

      return {
        stats: dashStats,
        recentOrders: recentOrdersData,
        salesData: salesTrend,
        popularMenuData: popularMenu,
        lowStockItems: lowStockList,
      };
    }
  };

  if (loading && !stats) {
    return (
      <MainLayout>
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <StatCardsSkeleton count={4} />
          <Skeleton className="h-40 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        </div>
      </MainLayout>
    );
  }

  // Kasir Dashboard
  if (isKaryawan()) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold">Dashboard Kasir</h1>
            <p className="text-muted-foreground mt-1">
              Selamat datang, {user?.name}! Berikut ringkasan penjualan Anda hari ini.
            </p>
          </div>

          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="stat-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Transaksi Hari Ini</p>
                      <p className="text-3xl font-bold mt-1 font-display">{stats.total_orders_today}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Penjualan Hari Ini</p>
                      <p className="text-2xl font-bold mt-1 font-display text-success">
                        {formatCurrency(stats.total_sales_today)}
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
                      <p className="text-sm text-muted-foreground">Profit Hari Ini</p>
                      <p className="text-2xl font-bold mt-1 font-display text-success">
                        {formatCurrency(stats.total_profit_today)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-success/10">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="card-elevated p-6">
                <h3 className="font-display font-semibold text-lg mb-4">Transaksi Terakhir</h3>
                {recentOrders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Belum ada transaksi hari ini</p>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                        <div>
                          <p className="font-medium">#{order.id} - {order.customer_name || 'Customer'}</p>
                          <p className="text-sm text-muted-foreground"> {order.user.name} • {new Date(order.created_at).toLocaleTimeString('id-ID')} </p>
                        </div>
                        <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </MainLayout>
    );
  }

  // Owner/Admin Dashboard
  return (
    <MainLayout>
      <div className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Selamat datang, {user?.name}! Berikut ringkasan bisnis Anda.
            </p>
          </div>

          {isAdmin() && (
            <div className="w-[200px]">
              <Select
                value={selectedStoreId}
                onValueChange={(val) => setSelectedStoreId(val)}
              >
                <SelectTrigger className="bg-background">
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
        </div>

        {stats && (
          <div className="space-y-8">

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 shadow-lg transform transition-all hover:scale-[1.02]">
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-primary-foreground/80 text-sm font-medium">Profit Bulan Ini</p>
                      <p className="text-3xl font-bold mt-2 font-display tracking-tight">
                        {formatCurrency(stats.total_profit_month)}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary-foreground/20 backdrop-blur-sm">
                      <TrendingUp className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-primary-foreground/60">
                    Performence yang baik!
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary-foreground/10 rounded-full blur-2xl"></div>
              </div>

              <div className="stat-card">
                <p className="text-sm text-muted-foreground">Omset Bulan Ini</p>
                <p className="text-2xl font-bold mt-1 text-primary">{formatCurrency(stats.total_sales_month)}</p>
                <div className="mt-2 text-xs text-success flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Total Pendapatan
                </div>
              </div>

              <div className="stat-card">
                <p className="text-sm text-muted-foreground">Transaksi Bulan Ini</p>
                <p className="text-2xl font-bold mt-1">{stats.total_orders_month}</p>
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" /> Total Order
                </div>
              </div>

              <div className="stat-card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Karyawan</p>
                    <p className="text-2xl font-bold mt-1">{stats.total_employees}</p>
                  </div>
                  <Users className="w-5 h-5 text-muted-foreground/50" />
                </div>
                {isAdmin() && selectedStoreId === 'all' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Akumulasi seluruh toko
                  </p>
                )}
              </div>
            </div>

            {/* ── Heatmap Jam Sibuk ───────────────────────────────────── */}
            <div className="card-elevated p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="font-display font-semibold text-lg">🔥 Heatmap Jam Sibuk</h3>
                  <p className="text-sm text-muted-foreground">
                    Jam paling ramai berdasarkan jumlah pesanan
                    {heatmapData && (
                      <span className="ml-2 text-xs font-medium text-primary">
                        — Total {heatmapData.total_days_orders} pesanan dalam {heatmapData.days} hari
                      </span>
                    )}
                  </p>
                </div>
                {/* Period selector */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto">
                  {(['7', '14', '30'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setHeatmapDays(d)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        heatmapDays === d
                          ? 'bg-background shadow text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {d}H
                    </button>
                  ))}
                </div>
              </div>

              {heatmapLoading ? (
                <div className="flex items-center justify-center h-24">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : heatmapData ? (
                <>
                  {/* Heatmap grid — 24 columns */}
                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                    {heatmapData.heatmap.map(bucket => (
                      <HeatmapCell
                        key={bucket.hour}
                        bucket={bucket}
                        maxOrders={heatmapData.max_orders}
                        themeColor={themeColor}
                      />
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <span className="text-xs text-muted-foreground">Sepi</span>
                    <div className="flex gap-0.5">
                      {[0.08, 0.25, 0.45, 0.65, 0.87].map((op, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-sm"
                          style={{ backgroundColor: themeColor, opacity: op }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">Ramai</span>
                  </div>

                  {/* Peak & Quiet hours summary */}
                  {(() => {
                    const sorted = [...heatmapData.heatmap].sort((a, b) => b.orders - a.orders);
                    const peak = sorted[0];
                    const quiet = sorted.filter(b => b.orders === 0);
                    const toLabel = (h: number) =>
                      h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
                    return (
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40">
                          <span className="text-2xl">🔥</span>
                          <div>
                            <p className="text-xs text-muted-foreground font-medium">Jam Tersibuk</p>
                            <p className="font-bold text-orange-600 dark:text-orange-400">
                              {toLabel(peak.hour)}{' '}
                              <span className="font-normal text-sm">({peak.orders} pesanan)</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                          <span className="text-2xl">😴</span>
                          <div>
                            <p className="text-xs text-muted-foreground font-medium">Jam Sepi</p>
                            <p className="font-bold text-blue-600 dark:text-blue-400">
                              {quiet.length} jam kosong
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-sm">Gagal memuat data heatmap</p>
              )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Trend Chart */}
              <div className="card-elevated p-6 min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-display font-semibold text-lg">Trend Penjualan</h3>
                    <p className="text-sm text-muted-foreground">7 Hari Terakhir</p>
                  </div>
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={themeColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={themeColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `${val / 1000}k`} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="total" stroke={themeColor} strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Popular Menu Chart */}
              <div className="card-elevated p-6 min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-display font-semibold text-lg">Menu Terpopuler</h3>
                    <p className="text-sm text-muted-foreground">Top 5 Berdasarkan Omset (7 Hari)</p>
                  </div>
                  <PieChart className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={popularMenuData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                      <Bar dataKey="sales" fill={themeColor} radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card-elevated p-6">
                <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-primary" />
                  Transaksi Terakhir
                </h3>
                {recentOrders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Belum ada transaksi</p>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border-b border-border last:border-0">
                        <div>
                          <p className="font-medium text-sm">#{order.id} - {order.customer_name || 'Pelanggan'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString('id-ID')}</p>
                        </div>
                        <span className="font-bold text-sm">{formatCurrency(order.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Stock Rendah
                </h3>
                {lowStockItems.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Stock aman</p>
                ) : (
                  <div className="space-y-3">
                    {lowStockItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-sm p-3 bg-warning/5 rounded-lg border border-warning/10">
                        <span>{item.name}</span>
                        <span className="text-warning font-bold">{item.current_stock} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </MainLayout>
  );
}
