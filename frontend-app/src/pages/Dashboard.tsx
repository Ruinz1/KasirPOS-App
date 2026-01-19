import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency, formatNumber } from '@/utils/calculations';
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

export default function Dashboard() {
  const { user, isKaryawan, canEdit, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [salesData, setSalesData] = useState<SalesChartData[]>([]);
  const [popularMenuData, setPopularMenuData] = useState<PopularMenuData[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin Filters
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

  useEffect(() => {
    if (isAdmin()) {
      fetchStores();
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      const response = await api.get('/stores-management');
      setStores(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
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

      setRecentOrders(ordersRes.data.slice(0, 5));

      // Fetch Inventory & Employees separately for better error handling
      if (canEdit()) {
        try {
          const inventoryRes = await api.get('/inventory', { params: { ...baseParams, type: 'stock' } });
          const lowStock = inventoryRes.data.filter((item: any) => item.is_low_stock);
          setLowStockItems(lowStock);
          dashStats.low_stock_items = lowStock.length;
        } catch (error) {
          console.error('Failed to fetch inventory:', error);
        }

        try {
          const empRes = await api.get('/employees', { params: baseParams });
          console.log('Employee API Response:', empRes.data);
          console.log('Employee Response Type:', typeof empRes.data, Array.isArray(empRes.data));
          console.log('Employee Count:', empRes.data?.length || 0);
          console.log('Base Params:', baseParams);

          // Ensure empRes.data is an array
          if (Array.isArray(empRes.data)) {
            dashStats.total_employees = empRes.data.length;
          } else {
            console.warn('Employee response is not an array:', empRes.data);
            dashStats.total_employees = 0;
          }
        } catch (error) {
          console.error('Failed to fetch employees:', error);
          dashStats.total_employees = 0;
        }
      }

      // Set stats AFTER all data is fetched
      console.log('Final dashStats:', dashStats);
      setStats(dashStats);

      // --- Chart Data Processing ---
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const chartParams = { ...baseParams, start_date: sevenDaysAgo.toISOString().split('T')[0], end_date: today };

      try {
        const chartOrdersRes = await api.get('/orders', { params: chartParams });
        const chartOrders = chartOrdersRes.data;

        // 1. Sales Trend (Daily)
        // 1. Sales Trend (Daily)
        const salesTrendMap = new Map<string, number>();
        const salesTrendDisplay: { name: string; total: number; date: Date }[] = [];

        // Initialize last 7 days including today
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
          salesTrendMap.set(dateKey, 0);

          salesTrendDisplay.push({
            name: d.toLocaleDateString('id-ID', { weekday: 'short' }),
            total: 0,
            date: d // Store date object for comparison
          });
        }

        chartOrders.forEach((o: any) => {
          const d = new Date(o.created_at);
          const dateKey = d.toISOString().split('T')[0]; // Match by date part only

          // Fallback check if timezone makes dates mismatch slightly, compare day/month/year
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

        // Clean up data for chart
        const salesChartData = salesTrendDisplay.map(({ name, total }) => ({ name, total }));
        setSalesData(salesChartData);

        // 2. Popular Menu (Profit Based)
        // Aggregate by menu_item name
        const menuStats: Record<string, { profit: number, sales: number }> = {};

        chartOrders.forEach((o: any) => {
          o.items.forEach((item: any) => {
            const menuName = item.menu_item.name;
            // Calculate Item Profit: (Price - COGS) * Qty
            // COGS might come from MenuItem relation if backend sends it.
            // Step 1745 OrderController does loading 'items.menuItem'.
            // MenuItem has COGS method but here we have JSON.
            // We rely on order.profit? No, that's total.
            // Let's APPROXIMATE item profit by prorating order profit? Or just assume margin.
            // Let's stick to SALES VOLUME (Qty) or REVENUE for simplicity unless we have per-item cost in JSON.
            // Actually, let's use Revenue. High revenue usually means high profit contribution for cafes.
            // Or better: Let's assume 50% margin if unknown, just to show a "Profit" bar? No that's fake.

            // Checking MenuItem model (Step 1738): `calculateCOGS`. `price`.
            // OrderController `index` loads `items.menuItem`.
            // Does it load `menuIngredients`? No.
            // So we don't know COGS on frontend here.
            // We ONLY know Selling Price.
            // I will display "Menu Populer (Omset)" - Revenue.
            // "Menguntungkan" can be interpreted as producing most money.

            if (!menuStats[menuName]) {
              menuStats[menuName] = { profit: 0, sales: 0 };
            }
            const itemTotal = item.price * item.quantity;
            menuStats[menuName].sales += itemTotal;
            // menuStats[menuName].profit += ... (Cannot accurately calc without COGS)
          });
        });

        // Convert to array and sort by Sales
        const popularMenu = Object.entries(menuStats)
          .map(([name, stat]) => ({ name, ...stat }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5); // Top 5

        setPopularMenuData(popularMenu);

      } catch (e) {
        console.error("Chart data error", e);
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
              {/* PROFIT CARD - Highlighted */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#5C4033] to-[#8B4513] text-white p-6 shadow-lg transform transition-all hover:scale-[1.02]">
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/80 text-sm font-medium">Profit Bulan Ini</p>
                      <p className="text-3xl font-bold mt-2 font-display tracking-tight">
                        {formatCurrency(stats.total_profit_month)}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-white/60">
                    Performence yang baik!
                  </div>
                </div>
                {/* Decor */}
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
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
                          <stop offset="5%" stopColor="#C8A17D" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#C8A17D" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `${val / 1000}k`} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="total" stroke="#C8A17D" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
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
                      <Bar dataKey="sales" fill="#5C4033" radius={[0, 4, 4, 0]} barSize={20} />
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
