import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency } from '@/utils/calculations';
import { Badge } from '@/components/ui/badge';
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
  Trash2,
  Edit2,
  Upload,
  Image as ImageIcon,
  Wallet,
  CalendarDays,
  TrendingDown,
  Activity,
  Receipt,
  Users
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
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { EditOrderDetailsDialog } from '@/components/EditOrderDetailsDialog';


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
  const [menuStats, setMenuStats] = useState<any[]>([]);
  const [showPaymentProofDialog, setShowPaymentProofDialog] = useState(false);
  const [selectedProofOrder, setSelectedProofOrder] = useState<any>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [initialCash, setInitialCash] = useState<string>('');
  const [showInitialCashDialog, setShowInitialCashDialog] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [shoppingData, setShoppingData] = useState<{ total: number; per_day: { date: string; total: number; item_count: number }[] }>({ total: 0, per_day: [] });
  const [showGajiCol, setShowGajiCol] = useState(true); // toggle kolom Operasional
  const [showGajiSummary, setShowGajiSummary] = useState(true); // toggle estimasi gaji di card ringkasan


  // Helper for timezone correct date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filters, setFilters] = useState({
    start_date: getLocalDateString(),
    end_date: getLocalDateString(),
    user_id: '',
    store_id: '',
  });

  const [receiptMode, setReceiptMode] = useState<'customer' | 'kitchen'>('customer');

  const generateKitchenCode = (name: string) => {
    // Split main part and variant part
    const match = name.match(/^([^(]+)(?:\(([^)]+)\))?/);
    if (!match) return name.substring(0, 3).toUpperCase();

    const mainPart = match[1].trim();
    const variantPart = match[2]?.trim();

    // Initials: "Bakso Biasa" -> "BB"
    const initials = mainPart.split(/\s+/).map(w => w[0]?.toUpperCase()).join('');

    if (variantPart) {
      // Clean prefixes
      const cleanVariant = variantPart.replace(/^(kuah|level|rasa)\s+/i, '');
      const formattedVariant = cleanVariant.charAt(0).toUpperCase() + cleanVariant.slice(1);
      return `${initials} -> ${formattedVariant}`;
    }

    return initials;
  };

  const navigate = useNavigate();

  // ... (useEffect hook content remains same, just replacing context slightly)

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

  // Live Update Polling
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (!loading && hasPermission('view_reports')) {
      interval = setInterval(() => {
        fetchData();
        setLastUpdate(new Date());
      }, 5000);
    }

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, loading, user]); // Re-setup when filters change

  useEffect(() => {
    if (orders.length > 0) {
      processChartData(orders, shoppingData.per_day || [], employees);
    } else {
      setChartData([]);
    }
  }, [chartView, orders, shoppingData, employees]);

  // Load initial cash from localStorage based on date and store
  useEffect(() => {
    const storageKey = `initialCash_${filters.start_date}_${filters.store_id || 'default'}`;
    const savedInitialCash = localStorage.getItem(storageKey);
    if (savedInitialCash) {
      setInitialCash(savedInitialCash);
    } else {
      setInitialCash('');
    }
  }, [filters.start_date, filters.store_id]);

  // Save initial cash to localStorage whenever it changes
  const saveInitialCash = (value: string) => {
    setInitialCash(value);
    const storageKey = `initialCash_${filters.start_date}_${filters.store_id || 'default'}`;
    if (value) {
      localStorage.setItem(storageKey, value);
    } else {
      localStorage.removeItem(storageKey);
    }
  };

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

      const [statsRes, ordersRes, shoppingRes, empRes] = await Promise.all([
        api.get('/orders/report/sales', { params }),
        api.get('/orders', { params }),
        api.get('/daily-shopping/range', {
          params: {
            start_date: filters.start_date,
            end_date: filters.end_date,
            ...(isAdmin() && filters.store_id && filters.store_id !== 'all' ? { store_id: filters.store_id } : {})
          }
        }),
        api.get('/employees', {
          params: {
            role: 'karyawan',
            ...(isAdmin() && filters.store_id && filters.store_id !== 'all' ? { store_id: filters.store_id } : {})
          }
        }),
      ]);

      const fetchedEmployees = empRes.data || [];
      setStats(statsRes.data);
      setShoppingData(shoppingRes.data || { total: 0, per_day: [] });
      setEmployees(fetchedEmployees);

      // Sort orders by created_at ascending (daily_number 1 first)
      const sortedOrders = (ordersRes.data || []).sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setOrders(sortedOrders);
      processChartData(sortedOrders, shoppingRes.data?.per_day || [], fetchedEmployees);

      // Calculate Menu Sales Stats (grouped by menu + kuah variant + packaging type)
      const items: any = {};
      (ordersRes.data || []).forEach((order: any) => {
        if (order.status === 'cancelled') return; // Skip cancelled orders

        order.items.forEach((item: any) => {
          const id = item.menu_item_id || item.menu_item?.id;
          const name = item.menu_item?.name || 'Unknown Item';

          // Extract kuah variant from note
          const noteText = item.note || '';
          const kuahMatch = noteText.match(/Kuah:\s*([^.]+)/);
          const kuahVariant = kuahMatch ? kuahMatch[1].trim() : '';

          // Determine packaging type:
          // takeaway order = all items dibungkus
          // dine_in + item.is_takeaway = dibungkus
          // dine_in + no is_takeaway = makan disini
          const isDibungkus = order.order_type === 'takeaway' || !!item.is_takeaway;
          const packagingType = isDibungkus ? 'Dibungkus' : 'Makan Disini';

          // Unique key: menu_id + kuah variant + packaging type
          const key = `${id}_${kuahVariant}_${packagingType}`;

          if (!items[key]) {
            items[key] = {
              name: name,
              kuahVariant: kuahVariant,
              packagingType: packagingType,
              quantity: 0,
              total: 0
            };
          }
          items[key].quantity += item.quantity;
          items[key].total += (Number(item.price) * item.quantity);
        });
      });

      // Sort: by menu name → kuah variant → packaging type
      const sortedMenuStats = Object.values(items).sort((a: any, b: any) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        const kuahCompare = (a.kuahVariant || '').localeCompare(b.kuahVariant || '');
        if (kuahCompare !== 0) return kuahCompare;
        // Makan Disini before Dibungkus
        return (a.packagingType || '').localeCompare(b.packagingType || '');
      });
      setMenuStats(sortedMenuStats);

    } catch (error: any) {
      console.error('Failed to fetch reports:', error);
      toast.error('Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (
    ordersData: any[],
    shoppingPerDayData: { date: string; total: number }[] = [],
    employeesData: any[] = []
  ) => {
    if (!ordersData || ordersData.length === 0) {
      setChartData([]);
      return;
    }

    // Build shopping map: YYYY-MM-DD → total belanja
    const shoppingMap: Record<string, number> = {};
    shoppingPerDayData.forEach((s) => {
      const d = new Date(s.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${dd}`;
      shoppingMap[iso] = (shoppingMap[iso] || 0) + Number(s.total);
    });

    // Hitung total gaji bulanan semua karyawan
    const totalMonthlySalary = employeesData.reduce((sum: number, emp: any) => {
      return sum + (Number(emp.monthly_salary) || 0);
    }, 0);

    const grouped: any = {};
    const groupedIso: Record<string, string> = {};

    ordersData.forEach((order) => {
      const date = new Date(order.created_at);
      let key = '';
      let isoKey = '';

      const y = date.getFullYear();
      const mon = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');

      if (chartView === 'daily') {
        isoKey = `${y}-${mon}-${dd}`;
        key = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      } else if (chartView === 'monthly') {
        key = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        isoKey = `${y}-${mon}`;
      } else {
        key = y.toString();
        isoKey = y.toString();
      }

      if (!grouped[key]) {
        grouped[key] = { name: key, pendapatan: 0, hpp: 0, gaji: 0, profit: 0, orders: 0 };
        groupedIso[key] = isoKey;
      }

      grouped[key].pendapatan += parseFloat(order.total) || 0;
      grouped[key].orders += 1;
    });

    // Inject HPP belanja harian & gaji ke setiap group
    Object.keys(grouped).forEach((key) => {
      const iso = groupedIso[key];

      // HPP dari belanja harian
      if (chartView === 'daily') {
        grouped[key].hpp = shoppingMap[iso] || 0;
        // Gaji: totalMonthlySalary / hari dalam bulan
        const [yr, mo] = iso.split('-').map(Number);
        const daysInMonth = new Date(yr, mo, 0).getDate();
        grouped[key].gaji = daysInMonth > 0 ? totalMonthlySalary / daysInMonth : 0;
      } else if (chartView === 'monthly') {
        grouped[key].hpp = Object.entries(shoppingMap)
          .filter(([k]) => k.startsWith(iso))
          .reduce((sum, [, v]) => sum + v, 0);
        // Gaji: 1 bulan penuh
        grouped[key].gaji = totalMonthlySalary;
      } else {
        // yearly
        grouped[key].hpp = Object.entries(shoppingMap)
          .filter(([k]) => k.startsWith(iso))
          .reduce((sum, [, v]) => sum + v, 0);
        // Gaji: 12 bulan
        grouped[key].gaji = totalMonthlySalary * 12;
      }

      // Profit bersih = Penjualan - HPP - Gaji
      grouped[key].profit = grouped[key].pendapatan - grouped[key].hpp - grouped[key].gaji;
    });

    setChartData(Object.values(grouped));
  };

  const handleViewOrder = async (orderId: number) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data);
      setShowReceipt(true);
      setReceiptMode('customer');
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      toast.error('Gagal memuat detail order');
    }
  };

  const handleEditOrder = (order: any) => {
    navigate('/pos', { state: { editOrder: order } });
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

  const DAILY_TARGET = 2500000;

  const getTargetAnalysis = () => {
    if (!stats) return { target: 0, sales: 0, achieved: false, percentage: 0, days: 0 };

    const start = new Date(filters.start_date);
    const end = new Date(filters.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const totalTarget = DAILY_TARGET * diffDays;
    const currentSales = Number(stats.total_sales) || 0;
    const achieved = currentSales >= totalTarget;
    const percentage = totalTarget > 0 ? (currentSales / totalTarget) * 100 : 0;

    return { target: totalTarget, sales: currentSales, achieved, percentage, days: diffDays };
  };

  const handleExportExcel = () => {
    const analysis = getTargetAnalysis();

    let totalMakanDisiniQty = 0;
    let totalMakanDisiniSales = 0;
    let totalDibungkusQty = 0;
    let totalDibungkusSales = 0;
    let totalMinumanQty = 0;
    let totalMinumanSales = 0;
    let totalSnackQty = 0;
    let totalSnackSales = 0;

    orders.forEach(order => {
      if (order.status === 'cancelled') return;
      order.items.forEach((item: any) => {
        if (!item.menu_item) return;
        const cat = item.menu_item.category?.toLowerCase() || '';
        const name = item.menu_item.name?.toLowerCase() || '';
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;

        const isMakanan = cat === 'makanan' || name.includes('bakso') || name.includes('mie') || name.includes('nasi');
        const isMinuman = name.includes('jeruk') || name.includes('aquviva') || name.includes('mineral') || name.includes('teh') || name.includes('gelas');
        const isSnack = cat === 'snack' || name.includes('kerupuk') || name.includes('krupuk') || name.includes('kacang') || name.includes('snack');

        if (isMakanan) {
          const isDibungkus = order.order_type === 'takeaway' || !!item.is_takeaway;
          if (isDibungkus) {
            totalDibungkusQty += qty;
            totalDibungkusSales += (price * qty);
          } else {
            totalMakanDisiniQty += qty;
            totalMakanDisiniSales += (price * qty);
          }
        }
        else if (isMinuman) {
          totalMinumanQty += qty;
          totalMinumanSales += (price * qty);
        }
        else if (isSnack) {
          totalSnackQty += qty;
          totalSnackSales += (price * qty);
        }
      });
    });

    // 1. Daily Summary Sheet
    const summaryData = [{
      'Periode Awal': filters.start_date,
      'Periode Akhir': filters.end_date,
      'Jumlah Hari': analysis.days,
      'Total Transaksi': stats?.total_orders || 0,
      'Total Penjualan': stats?.total_sales || 0,
      'Total HPP': stats?.total_cogs || 0,
      'Total Profit': stats?.total_profit || 0,
      'Target Penjualan (Rp)': analysis.target,
      'Status Target': analysis.achieved ? 'TERCAPAI' : 'BELUM TERCAPAI',
      'Persentase Capaian': `${analysis.percentage.toFixed(2)}%`,
      'Item Makan Disini (Qty)': totalMakanDisiniQty,
      'Item Dibungkus (Qty)': totalDibungkusQty,
      'Penjualan Makan Disini (Rp)': totalMakanDisiniSales,
      'Penjualan Dibungkus (Rp)': totalDibungkusSales,
      'Item Minuman (Qty)': totalMinumanQty,
      'Penjualan Minuman (Rp)': totalMinumanSales,
      'Item Snack (Qty)': totalSnackQty,
      'Penjualan Snack (Rp)': totalSnackSales
    }];

    // 2. Menu Sales Sheet
    const menuData = (menuStats as any[]).map(item => ({
      'Nama Menu': item.name,
      'Variasi Kuah': item.kuahVariant || '-',
      'Tipe': item.packagingType || '-',
      'Terjual (Qty)': item.quantity,
      'Total Penjualan (Rp)': item.total
    }));

    // 3. Detailed Sales Report - Group by menu item + kuah variant + packaging + payment method
    const groupedData: any = {};

    orders.forEach((order) => {
      if (order.status === 'cancelled') return;

      order.items.forEach((item: any) => {
        const menuName = item.menu_item?.name || 'Unknown';
        const paymentMethod = order.payment_method === 'cash' ? 'Cash' :
          order.payment_method === 'card' ? 'Card' :
            order.payment_method === 'qris' ? 'Transfer' :
              order.payment_method;

        // Extract kuah variant from note
        const noteText = item.note || '';
        const kuahMatch = noteText.match(/Kuah:\s*([^.]+)/);
        const kuahVariant = kuahMatch ? kuahMatch[1].trim() : '';

        // Determine packaging type
        const isDibungkus = (order as any).order_type === 'takeaway' || !!item.is_takeaway;
        const packagingType = isDibungkus ? 'Dibungkus' : 'Makan Disini';

        // Create unique key: menuName + kuahVariant + packaging + paymentMethod
        const key = `${menuName}_${kuahVariant}_${packagingType}_${paymentMethod}`;

        if (!groupedData[key]) {
          groupedData[key] = {
            name: menuName,
            kuahVariant: kuahVariant,
            packagingType: packagingType,
            quantity: 0,
            cogs: item.menu_item?.cogs || 0,
            price: item.price,
            totalSales: 0,
            payment: paymentMethod
          };
        }

        groupedData[key].quantity += item.quantity;
        groupedData[key].totalSales += (item.price * item.quantity);
      });
    });

    // Convert to array format for Excel
    const detailedSalesData = Object.values(groupedData).map((item: any) => ({
      'Nama barang': item.name,
      'Variasi Kuah': item.kuahVariant || '-',
      'Tipe': item.packagingType,
      'Keluar': item.quantity,
      'Harga pokok': item.cogs,
      'Harga Jual': item.price,
      'Total Penjualan': item.totalSales,
      'Pembayaran': item.payment,
      'Keterangan': ''
    }));

    // Sort by Payment Method (Cash first, then Transfer/others) and then by Item Name
    detailedSalesData.sort((a, b) => {
      const paymentOrder: { [key: string]: number } = { 'Cash': 1, 'Transfer': 2, 'Card': 3 };
      const pA = paymentOrder[a['Pembayaran']] || 99;
      const pB = paymentOrder[b['Pembayaran']] || 99;

      if (pA !== pB) return pA - pB;
      const nameCompare = a['Nama barang'].localeCompare(b['Nama barang']);
      if (nameCompare !== 0) return nameCompare;
      const kuahCompare = (a['Variasi Kuah'] || '').localeCompare(b['Variasi Kuah'] || '');
      if (kuahCompare !== 0) return kuahCompare;
      return (a['Tipe'] || '').localeCompare(b['Tipe'] || '');
    });

    // Calculate totals
    const totalHargaPokok = detailedSalesData.reduce((sum, item) => sum + (Number(item['Harga pokok']) || 0), 0);
    const totalHargaJual = detailedSalesData.reduce((sum, item) => sum + (Number(item['Harga Jual']) || 0), 0);
    const totalPenjualan = detailedSalesData.reduce((sum, item) => sum + (Number(item['Total Penjualan']) || 0), 0);

    // Add TOTAL row
    detailedSalesData.push({
      'Nama barang': 'TOTAL',
      'Variasi Kuah': '',
      'Tipe': '',
      'Keluar': '',
      'Harga pokok': totalHargaPokok,
      'Harga Jual': totalHargaJual,
      'Total Penjualan': totalPenjualan,
      'Pembayaran': '',
      'Keterangan': ''
    });

    // 4. Transactions Sheet with Payment Summary
    const transactionData = orders.map(order => ({
      'Daily Number': order.daily_number || order.id,
      'Tanggal': new Date(order.created_at).toLocaleDateString('id-ID'),
      'Jam': new Date(order.created_at).toLocaleTimeString('id-ID'),
      'Customer': order.customer_name || '-',
      'Metode Pembayaran': order.second_payment_method
        ? `${order.payment_method} + ${order.second_payment_method}`
        : order.payment_method,
      'Status': order.status === 'cancelled' ? 'Dibatalkan' :
        order.payment_status === 'pending' ? 'Belum Bayar' : 'Lunas',
      'Modal Awal': order.initial_cash || 0,
      'Total': order.total,
      'Uang Dibayar': (order.paid_amount || 0) + (order.second_paid_amount || 0),
      'Kembalian': order.change_amount || 0,
      'Uang di Kasir': (order.initial_cash || 0) + (Number(order.payment_method === 'cash' ? order.paid_amount : 0) + Number(order.second_payment_method === 'cash' ? order.second_paid_amount : 0)) - (order.change_amount || 0),
      'HPP': order.cogs,
      'Profit': order.profit
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Laporan");

    // Menu Sales Sheet
    const wsMenu = XLSX.utils.json_to_sheet(menuData);
    XLSX.utils.book_append_sheet(wb, wsMenu, "Penjualan Menu");

    // Detailed Sales Sheet with Styling
    const wsDetailed = XLSX.utils.json_to_sheet(detailedSalesData);

    // Apply styling to detailed sheet
    const range = XLSX.utils.decode_range(wsDetailed['!ref'] || 'A1');

    // Set column widths
    wsDetailed['!cols'] = [
      { wch: 30 }, // Nama barang
      { wch: 18 }, // Variasi Kuah
      { wch: 15 }, // Tipe
      { wch: 10 }, // Keluar
      { wch: 15 }, // Harga pokok
      { wch: 15 }, // Harga Jual
      { wch: 18 }, // Total Penjualan
      { wch: 15 }, // Pembayaran
      { wch: 20 }  // Keterangan
    ];

    // Style header row (green background)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!wsDetailed[address]) continue;
      wsDetailed[address].s = {
        fill: { fgColor: { rgb: "92D050" } },
        font: { bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }

    // Style TOTAL row (yellow background) - last row
    const totalRowNum = range.e.r + 1;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + totalRowNum;
      if (!wsDetailed[address]) continue;
      wsDetailed[address].s = {
        fill: { fgColor: { rgb: "FFFF00" } },
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }

    XLSX.utils.book_append_sheet(wb, wsDetailed, "Detail Penjualan Harian");

    // Transactions Sheet
    const wsTrans = XLSX.utils.json_to_sheet(transactionData);
    XLSX.utils.book_append_sheet(wb, wsTrans, "Daftar Transaksi");

    XLSX.writeFile(wb, `Laporan_POS_${filters.start_date}_${filters.end_date}.xlsx`);
    toast.success('Laporan berhasil didownload');
  };

  const handleUploadPaymentProof = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !selectedProofOrder) return;

    const files = Array.from(event.target.files);

    // Validate max 5 images
    if (files.length > 5) {
      toast.error('Maksimal 5 gambar per upload');
      return;
    }

    // Validate file types and sizes
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`File ${file.name} bukan gambar`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast.error(`File ${file.name} terlalu besar (max 5MB)`);
        return;
      }
    }

    await uploadFiles(files);

    // Reset file input
    event.target.value = '';
  };

  // Helper function to upload files
  const uploadFiles = async (files: File[]) => {
    if (!selectedProofOrder) return;

    setUploadingProof(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('images[]', file);
      });

      const response = await api.post(`/orders/${selectedProofOrder.id}/payment-proof`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(`${files.length} bukti pembayaran berhasil diupload`);

      // Update order in list
      setOrders(orders.map(o => o.id === selectedProofOrder.id ? response.data.order : o));
      setSelectedProofOrder(response.data.order);
    } catch (error: any) {
      console.error('Failed to upload payment proof:', error);
      toast.error(error.response?.data?.message || 'Gagal upload bukti pembayaran');
    } finally {
      setUploadingProof(false);
    }
  };

  // Handle paste event for images
  const handlePasteImage = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Validate file size
          if (file.size > 5 * 1024 * 1024) {
            toast.error('Gambar terlalu besar (max 5MB)');
            return;
          }
          files.push(file);
        }
      }
    }

    if (files.length === 0) {
      toast.error('Tidak ada gambar di clipboard');
      return;
    }

    if (files.length > 5) {
      toast.error('Maksimal 5 gambar per upload');
      return;
    }

    await uploadFiles(files);
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
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold">Laporan Penjualan</h1>
              <Badge className="bg-green-500 text-white animate-pulse">
                ● LIVE
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              {isKaryawan() ? 'Lihat laporan penjualan Anda' : 'Monitor performa penjualan tim'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInitialCashDialog(true)}
              className="btn-primary flex items-center gap-2"
              title="Input Modal Awal Kasir"
            >
              <Wallet className="w-4 h-4" />
              {initialCash ? 'Edit Modal Awal' : 'Input Modal Awal'}
            </button>
            <button
              className="btn-outline flex items-center gap-2"
              onClick={handleExportExcel}
              disabled={!stats}
            >
              <Printer className="w-4 h-4" /> Export Excel
            </button>
          </div>
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

        {/* Target Analysis Card */}
        {stats && (
          <div className="card-elevated p-6 mb-8 bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-l-primary">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="font-display font-semibold text-lg text-primary flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Analisa Target Penjualan
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Target: {formatCurrency(DAILY_TARGET)} x {getTargetAnalysis().days} hari = <strong>{formatCurrency(getTargetAnalysis().target)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Realisasi</p>
                  <p className={`text-xl font-bold ${getTargetAnalysis().achieved ? 'text-success' : 'text-warning'}`}>
                    {formatCurrency(getTargetAnalysis().sales)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTargetAnalysis().achieved ? 'bg-success/20 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {getTargetAnalysis().achieved ? 'TERCAPAI 🎉' : 'BELUM TERCAPAI'}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-secondary h-2 rounded-full mt-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${getTargetAnalysis().achieved ? 'bg-success' : 'bg-warning'}`}
                style={{ width: `${Math.min(getTargetAnalysis().percentage, 100)}%` }}
              />
            </div>
            <div className="text-right text-xs text-muted-foreground mt-1">
              {getTargetAnalysis().percentage.toFixed(1)}% dari target
            </div>
          </div>
        )}

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

        {/* Recap Dine In & Take Away */}
        {orders.length > 0 && (() => {
          let totalMakanDisiniQty = 0;
          let totalMakanDisiniSales = 0;
          let totalDibungkusQty = 0;
          let totalDibungkusSales = 0;
          let totalMinumanQty = 0;
          let totalMinumanSales = 0;
          let totalSnackQty = 0;
          let totalSnackSales = 0;

          orders.forEach((order: any) => {
            if (order.status === 'cancelled') return;
            order.items.forEach((item: any) => {
              if (!item.menu_item) return;
              const cat = item.menu_item.category?.toLowerCase() || '';
              const name = item.menu_item.name?.toLowerCase() || '';
              const price = Number(item.price) || 0;
              const qty = Number(item.quantity) || 0;

              const isMakanan = cat === 'makanan' || name.includes('bakso') || name.includes('mie') || name.includes('nasi');
              const isMinuman = name.includes('jeruk') || name.includes('aquviva') || name.includes('mineral') || name.includes('teh') || name.includes('gelas');
              const isSnack = cat === 'snack' || name.includes('kerupuk') || name.includes('krupuk') || name.includes('kacang') || name.includes('snack');

              if (isMakanan) {
                const isDibungkus = order.order_type === 'takeaway' || !!item.is_takeaway;
                if (isDibungkus) {
                  totalDibungkusQty += qty;
                  totalDibungkusSales += (price * qty);
                } else {
                  totalMakanDisiniQty += qty;
                  totalMakanDisiniSales += (price * qty);
                }
              }
              else if (isMinuman) {
                totalMinumanQty += qty;
                totalMinumanSales += (price * qty);
              }
              else if (isSnack) {
                totalSnackQty += qty;
                totalSnackSales += (price * qty);
              }
            });
          });

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="card-elevated p-5 bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <span className="text-lg">🍽️</span>
                  </div>
                  <h3 className="font-semibold text-sm">Dine In (Bakso/Mkn)</h3>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold">{totalMakanDisiniQty} <span className="text-xs font-normal text-muted-foreground">porsi</span></p>
                  <p className="text-sm font-semibold text-success mt-1">{formatCurrency(totalMakanDisiniSales)}</p>
                </div>
              </div>

              <div className="card-elevated p-5 bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-amber-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                    <span className="text-lg">📦</span>
                  </div>
                  <h3 className="font-semibold text-sm">Take Away (Bakso/Mkn)</h3>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold">{totalDibungkusQty} <span className="text-xs font-normal text-muted-foreground">porsi</span></p>
                  <p className="text-sm font-semibold text-success mt-1">{formatCurrency(totalDibungkusSales)}</p>
                </div>
              </div>

              <div className="card-elevated p-5 bg-cyan-50/50 dark:bg-cyan-900/10 border-l-4 border-cyan-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg text-cyan-600 dark:text-cyan-400">
                    <span className="text-lg">🥤</span>
                  </div>
                  <h3 className="font-semibold text-sm">Minuman (Teh/Jeruk/dll)</h3>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold">{totalMinumanQty} <span className="text-xs font-normal text-muted-foreground">gelas</span></p>
                  <p className="text-sm font-semibold text-success mt-1">{formatCurrency(totalMinumanSales)}</p>
                </div>
              </div>

              <div className="card-elevated p-5 bg-orange-50/50 dark:bg-orange-900/10 border-l-4 border-orange-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                    <span className="text-lg">🍪</span>
                  </div>
                  <h3 className="font-semibold text-sm">Snack/Kerupuk</h3>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold">{totalSnackQty} <span className="text-xs font-normal text-muted-foreground">bks</span></p>
                  <p className="text-sm font-semibold text-success mt-1">{formatCurrency(totalSnackSales)}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* === ANALISIS RATA-RATA & RINCIAN HARIAN === */}
        {stats && (() => {
          const analysis = getTargetAnalysis();
          const days = analysis.days;
          const totalSales = Number(stats.total_sales) || 0;
          const totalCogs = Number(stats.total_cogs) || 0;
          const totalProfit = Number(stats.total_profit) || 0;
          const totalOrders = Number(stats.total_orders) || 0;

          const avgSalesPerDay = days > 0 ? totalSales / days : 0;
          const avgCogsPerDay = days > 0 ? totalCogs / days : 0;
          const avgProfitPerDay = days > 0 ? totalProfit / days : 0;
          const avgOrdersPerDay = days > 0 ? totalOrders / days : 0;
          const avgSalesPerOrder = totalOrders > 0 ? totalSales / totalOrders : 0;
          const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

          // Build per-day breakdown — gunakan isoDate untuk lookup & sorting agar akurat
          const perDayMap: Record<string, { isoDate: string; displayDate: string; orders: number; pendapatan: number; hpp: number; profit: number }> = {};
          orders.forEach((order: any) => {
            if (order.status === 'cancelled') return;
            const d = new Date(order.created_at);
            // Gunakan local date string untuk key agar tidak kena timezone UTC issue
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const isoDate = `${y}-${m}-${dd}`;
            const displayDate = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            if (!perDayMap[isoDate]) {
              perDayMap[isoDate] = { isoDate, displayDate, orders: 0, pendapatan: 0, hpp: 0, profit: 0 };
            }
            perDayMap[isoDate].orders += 1;
            perDayMap[isoDate].pendapatan += parseFloat(order.total) || 0;
            perDayMap[isoDate].hpp += parseFloat(order.cogs) || 0;
            perDayMap[isoDate].profit += parseFloat(order.profit) || 0;
          });
          // Sort berdasarkan isoDate string (YYYY-MM-DD) — aman dan akurat
          const perDayData = Object.values(perDayMap).sort((a, b) => a.isoDate.localeCompare(b.isoDate));

          // === HPP BELANJA HARIAN ===
          const totalShoppingHpp = shoppingData.total || 0;
          // Map belanja per hari untuk tampil di tabel rincian
          const shoppingPerDayMap: Record<string, number> = {};
          const shoppingItemCountMap: Record<string, number> = {};
          (shoppingData.per_day || []).forEach((d: any) => {
            const key = String(d.date || '').substring(0, 10); // normalisasi ke YYYY-MM-DD
            shoppingPerDayMap[key] = Number(d.total) || 0;
            shoppingItemCountMap[key] = Number(d.item_count) || 0;
          });

          // === KALKULASI GAJI PROPORSIONAL ===
          const startD = new Date(filters.start_date);
          const daysInMonth = new Date(startD.getFullYear(), startD.getMonth() + 1, 0).getDate();

          let totalSalaryForRange = 0;
          const salaryBreakdown: { name: string; monthlySalary: number; salaryType: string; baseSalary: number; bonus: number; prorated: number }[] = [];
          employees.forEach((emp: any) => {
            const monthlySalary = Number(emp.monthly_salary) || 0;
            if (monthlySalary > 0) {
              const prorated = (monthlySalary / daysInMonth) * days;
              totalSalaryForRange += prorated;
              salaryBreakdown.push({
                name: emp.name,
                monthlySalary,
                salaryType: emp.salary_type || 'auto',
                baseSalary: Number(emp.base_salary) || 0,
                bonus: Number(emp.bonus) || 0,
                prorated,
              });
            }
          });

          // Laba bersih = Penjualan - HPP Belanja Harian - Gaji
          const netProfitAfterSalary = totalSales - totalShoppingHpp - totalSalaryForRange;
          const netProfitMargin = totalSales > 0 ? (netProfitAfterSalary / totalSales) * 100 : 0;

          const isMultiDay = days > 1;

          return (
            <div className="card-elevated p-6 mb-8">
              {/* Header */}
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-display font-semibold text-lg">Analisis Rata-rata & Rincian Harian</h3>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {filters.start_date === filters.end_date
                    ? filters.start_date
                    : `${filters.start_date} → ${filters.end_date} (${days} hari)`}
                </span>
              </div>

              {/* Rata-rata Cards */}
              {(() => {
                const gajiPerHari = days > 0 ? totalSalaryForRange / days : 0;
                const avgShoppingPerDay = days > 0 ? totalShoppingHpp / days : 0;
                const avgTotalOperasionalPerDay = avgShoppingPerDay + gajiPerHari; // HPP + Gaji
                const avgNetProfitPerDay = days > 0 ? netProfitAfterSalary / days : 0;
                const netMarginPerOrder = totalOrders > 0 ? netProfitAfterSalary / totalOrders : 0;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="rounded-xl border border-border p-4 bg-gradient-to-br from-success/5 to-transparent">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-success" />
                        <p className="text-xs text-muted-foreground">Rata-rata Penjualan/Hari</p>
                      </div>
                      <p className="text-lg font-bold text-success">{formatCurrency(avgSalesPerDay)}</p>
                      {isMultiDay && <p className="text-xs text-muted-foreground mt-0.5">dari {days} hari</p>}
                    </div>

                    <div className="rounded-xl border border-border p-4 bg-gradient-to-br from-warning/5 to-transparent">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-4 h-4 text-warning" />
                        <p className="text-xs text-muted-foreground">Rata-rata Operasional/Hari</p>
                      </div>
                      <p className="text-lg font-bold text-warning">{formatCurrency(avgTotalOperasionalPerDay)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Belanja {formatCurrency(avgShoppingPerDay)} + Gaji {formatCurrency(gajiPerHari)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border p-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-blue-500" />
                        <p className="text-xs text-muted-foreground">Rata-rata Untung Bersih/Hari</p>
                      </div>
                      <p className={`text-lg font-bold ${avgNetProfitPerDay >= 0 ? 'text-blue-500' : 'text-destructive'}`}>
                        {formatCurrency(avgNetProfitPerDay)}
                      </p>
                      {isMultiDay && <p className="text-xs text-muted-foreground mt-0.5">dari {days} hari</p>}
                    </div>

                    <div className="rounded-xl border border-border p-4 bg-gradient-to-br from-primary/5 to-transparent">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                        <p className="text-xs text-muted-foreground">Rata-rata Transaksi/Hari</p>
                      </div>
                      <p className="text-lg font-bold">{avgOrdersPerDay.toFixed(1)}</p>
                      {isMultiDay && <p className="text-xs text-muted-foreground mt-0.5">dari {days} hari</p>}
                    </div>

                    <div className="rounded-xl border border-border p-4 bg-gradient-to-br from-purple-500/5 to-transparent">
                      <div className="flex items-center gap-2 mb-1">
                        <Receipt className="w-4 h-4 text-purple-500" />
                        <p className="text-xs text-muted-foreground">Rata-rata/Transaksi</p>
                      </div>
                      <p className="text-lg font-bold text-purple-500">{formatCurrency(avgSalesPerOrder)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Margin bersih: {netProfitMargin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Rincian Per Hari — hanya tampil jika range > 1 hari */}
              {isMultiDay && perDayData.length > 0 && (() => {
                const gajiPerHari = days > 0 ? totalSalaryForRange / days : 0;
                return (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">Rincian Per Hari</p>
                        <span className="text-xs text-muted-foreground">
                          (Untung Bersih = Penjualan − Belanja{showGajiCol ? ' − Operasional' : ''})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGajiCol(v => !v)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:bg-secondary transition-colors"
                        title={showGajiCol ? 'Sembunyikan kolom Operasional' : 'Tampilkan kolom Operasional'}
                      >
                        {showGajiCol ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg> Operasional</>
                        ) : (
                          <><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg> <span className="text-muted-foreground">Operasional</span></>
                        )}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="text-left py-2.5 px-3 font-semibold">Tanggal</th>
                            <th className="text-right py-2.5 px-3 font-semibold">Trx</th>
                            <th className="text-right py-2.5 px-3 font-semibold text-success">Penjualan</th>
                            <th className="text-right py-2.5 px-3 font-semibold text-warning">Belanja</th>
                            {showGajiCol && (
                              <th className="text-right py-2.5 px-3 font-semibold text-orange-500">
                                Operasional
                                <div className="text-[10px] font-normal text-muted-foreground">Gaji/Hari</div>
                              </th>
                            )}
                            <th className="text-right py-2.5 px-3 font-semibold text-blue-500">
                              Untung Bersih
                              {!showGajiCol && (
                                <div className="text-[10px] font-normal text-muted-foreground">tanpa operasional</div>
                              )}
                            </th>
                            <th className="text-right py-2.5 px-3 font-semibold">Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {perDayData.map((row, idx) => {
                            const belanja = shoppingPerDayMap[row.isoDate] || 0;
                            const untungBersih = showGajiCol
                              ? row.pendapatan - belanja - gajiPerHari
                              : row.pendapatan - belanja;
                            const margin = row.pendapatan > 0 ? (untungBersih / row.pendapatan) * 100 : 0;
                            const isBelowAvg = row.pendapatan < avgSalesPerDay;
                            const isProfit = untungBersih >= 0;
                            return (
                              <tr key={idx} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${isBelowAvg ? 'opacity-75' : ''}`}>
                                <td className="py-2.5 px-3 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                                    {row.displayDate}
                                    <span className={`text-xs ${isBelowAvg ? 'text-destructive' : 'text-success'}`}>
                                      {isBelowAvg ? '↓' : '↑'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right">{row.orders}</td>
                                <td className="py-2.5 px-3 text-right font-medium text-success">{formatCurrency(row.pendapatan)}</td>
                                <td className="py-2.5 px-3 text-right text-warning">
                                  {belanja > 0 ? (
                                    <div>
                                      <div className="font-medium">{formatCurrency(belanja)}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {shoppingItemCountMap[row.isoDate] || 0} item
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </td>
                                {showGajiCol && (
                                  <td className="py-2.5 px-3 text-right text-orange-500 text-xs">{formatCurrency(gajiPerHari)}</td>
                                )}
                                <td className="py-2.5 px-3 text-right font-bold">
                                  <span className={isProfit ? 'text-success' : 'text-destructive'}>
                                    {formatCurrency(untungBersih)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${margin >= 20 ? 'bg-success/10 text-success' :
                                    margin >= 10 ? 'bg-warning/10 text-warning' :
                                      margin >= 0 ? 'bg-secondary text-muted-foreground' :
                                        'bg-destructive/10 text-destructive'
                                    }`}>
                                    {margin.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Total Row */}
                        <tfoot>
                          <tr className="border-t-2 border-border font-bold bg-secondary/20">
                            <td className="py-3 px-3">TOTAL ({days} hari)</td>
                            <td className="py-3 px-3 text-right">{totalOrders}</td>
                            <td className="py-3 px-3 text-right text-success">{formatCurrency(totalSales)}</td>
                            <td className="py-3 px-3 text-right text-warning">{formatCurrency(totalShoppingHpp)}</td>
                            {showGajiCol && (
                              <td className="py-3 px-3 text-right text-orange-500">{formatCurrency(totalSalaryForRange)}</td>
                            )}
                            <td className="py-3 px-3 text-right">
                              {(() => {
                                const totalUntung = showGajiCol
                                  ? netProfitAfterSalary
                                  : totalSales - totalShoppingHpp;
                                const totalMargin = totalSales > 0 ? (totalUntung / totalSales) * 100 : 0;
                                return (
                                  <span className={totalUntung >= 0 ? 'text-success' : 'text-destructive'}>
                                    {formatCurrency(totalUntung)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {(() => {
                                const totalUntung = showGajiCol
                                  ? netProfitAfterSalary
                                  : totalSales - totalShoppingHpp;
                                const totalMargin = totalSales > 0 ? (totalUntung / totalSales) * 100 : 0;
                                return (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${totalMargin >= 20 ? 'bg-success/10 text-success' :
                                    totalMargin >= 10 ? 'bg-warning/10 text-warning' :
                                      totalMargin >= 0 ? 'bg-secondary text-muted-foreground' :
                                        'bg-destructive/10 text-destructive'
                                    }`}>
                                    {totalMargin.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                );
              })()}

              {/* Single day summary — analisa lengkap untuk 1 hari */}
              {!isMultiDay && (() => {
                const gajiHariIni = days > 0 ? totalSalaryForRange / days : 0;
                const belanjaHariIni = totalShoppingHpp;
                const untungBersihHariIni = totalSales - belanjaHariIni - gajiHariIni;
                const marginHariIni = totalSales > 0 ? (untungBersihHariIni / totalSales) * 100 : 0;
                return (
                  <div className="mt-4 rounded-xl border border-border overflow-hidden">
                    <div className="bg-secondary/20 px-4 py-2.5 border-b border-border">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Analisa Keuntungan Hari Ini — {filters.start_date}
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-border/50">
                          <td className="py-2.5 px-4 text-muted-foreground">Penjualan</td>
                          <td className="py-2.5 px-4 text-right font-medium text-success">{formatCurrency(totalSales)}</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-2.5 px-4 text-muted-foreground">Belanja Harian (HPP)</td>
                          <td className="py-2.5 px-4 text-right text-warning">- {formatCurrency(belanjaHariIni)}</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-2.5 px-4 text-muted-foreground">
                            Gaji Karyawan/Hari
                            {salaryBreakdown.length > 0 && (
                              <span className="text-xs ml-1 text-muted-foreground">
                                ({formatCurrency(totalSalaryForRange)}/{daysInMonth} hari)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right text-orange-500">- {formatCurrency(gajiHariIni)}</td>
                        </tr>
                        <tr className="bg-secondary/10">
                          <td className="py-3 px-4 font-bold">Untung Bersih</td>
                          <td className={`py-3 px-4 text-right font-bold text-lg ${untungBersihHariIni >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(untungBersihHariIni)}
                            <span className="text-xs font-normal ml-1 text-muted-foreground">
                              ({marginHariIni.toFixed(1)}%)
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}



              {/* === SECTION GAJI === */}
              {salaryBreakdown.length > 0 && (
                <>
                  <div className="border-t border-border mt-6 pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-4 h-4 text-orange-500" />
                      <p className="text-sm font-semibold">Estimasi Gaji Karyawan</p>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        {days} hari dari {daysInMonth} hari dalam bulan
                      </span>
                    </div>

                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-orange-500/5">
                            <th className="text-left py-2.5 px-4 font-semibold">Karyawan</th>
                            <th className="text-left py-2.5 px-4 font-semibold">Tipe</th>
                            <th className="text-right py-2.5 px-4 font-semibold">Gaji Bulanan</th>
                            <th className="text-right py-2.5 px-4 font-semibold">Bonus</th>
                            <th className="text-right py-2.5 px-4 font-semibold text-orange-500">Estimasi ({days} hari)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salaryBreakdown.map((emp, idx) => (
                            <tr key={idx} className="border-b border-border/50 hover:bg-secondary/20">
                              <td className="py-2.5 px-4 font-medium">{emp.name}</td>
                              <td className="py-2.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.salaryType === 'manual'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-secondary text-muted-foreground'
                                  }`}>
                                  {emp.salaryType === 'manual' ? 'Manual' : 'Auto (50rb/hari)'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right">{formatCurrency(emp.monthlySalary)}</td>
                              <td className="py-2.5 px-4 text-right text-muted-foreground">
                                {emp.bonus > 0 ? `+${formatCurrency(emp.bonus)}` : '-'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-medium text-orange-500">
                                {formatCurrency(emp.prorated)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border font-bold bg-orange-500/5">
                            <td className="py-3 px-4" colSpan={4}>Total Estimasi Gaji ({days} hari)</td>
                            <td className="py-3 px-4 text-right text-orange-500">{formatCurrency(totalSalaryForRange)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Ringkasan Laba Bersih */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div className="rounded-xl border border-border p-4 bg-success/5">
                        <p className="text-xs text-muted-foreground mb-1">Total Penjualan</p>
                        <p className="text-lg font-bold text-success">{formatCurrency(totalSales)}</p>
                      </div>
                      <div className="rounded-xl border border-border p-4 bg-warning/5">
                        <p className="text-xs text-muted-foreground mb-1">HPP (Belanja Harian)</p>
                        <p className="text-lg font-bold text-warning">- {formatCurrency(totalShoppingHpp)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">dari data belanja</p>
                      </div>

                      <div className="rounded-xl border border-border p-4 bg-orange-500/5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground">Estimasi Gaji</p>
                          <button
                            type="button"
                            onClick={() => setShowGajiSummary(v => !v)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title={showGajiSummary ? 'Kecualikan gaji dari Laba Bersih' : 'Sertakan gaji ke Laba Bersih'}
                          >
                            {showGajiSummary ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            )}
                          </button>
                        </div>
                        {showGajiSummary ? (
                          <>
                            <p className="text-lg font-bold text-orange-500">- {formatCurrency(totalSalaryForRange)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{days} hari</p>
                          </>
                        ) : (
                          <div className="mt-2">
                            <span className="text-xs font-medium bg-secondary px-2 py-1 rounded-md text-muted-foreground">
                              Dikecualikan
                            </span>
                          </div>
                        )}
                      </div>

                      {(() => {
                        const activeLabaBersih = showGajiSummary
                          ? netProfitAfterSalary
                          : totalSales - totalShoppingHpp;
                        const activeMargin = totalSales > 0 ? (activeLabaBersih / totalSales) * 100 : 0;

                        return (
                          <div className={`rounded-xl border-2 p-4 ${activeLabaBersih >= 0
                            ? 'border-success bg-success/5'
                            : 'border-destructive bg-destructive/5'
                            }`}>
                            <p className="text-xs text-muted-foreground mb-1">
                              Laba Bersih {!showGajiSummary && <span className="text-[10px] ml-1">(Tanpa Gaji)</span>}
                            </p>
                            <p className={`text-xl font-bold ${activeLabaBersih >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatCurrency(activeLabaBersih)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Margin bersih: {activeMargin.toFixed(1)}%</p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* === RINCIAN SETORAN KAS PER METODE PEMBAYARAN === */}
                    {(() => {
                      const paidOrders = orders.filter((o: any) => o.status !== 'cancelled' && o.payment_status === 'paid');

                      const sumByMethod = (method: string) =>
                        paidOrders.reduce((sum: number, o: any) => {
                          let s = 0;
                          if (o.payment_method === method) s += Number(o.paid_amount || o.total || 0);
                          if (o.second_payment_method === method) s += Number(o.second_paid_amount || 0);
                          return sum + s;
                        }, 0);

                      const totalCashReceived = sumByMethod('cash');
                      const totalCashChange = paidOrders.reduce((sum: number, o: any) => {
                        if (o.payment_method === 'cash' || o.second_payment_method === 'cash') {
                          return sum + Number(o.change_amount || 0);
                        }
                        return sum;
                      }, 0);

                      const initialCashValue = initialCash ? parseFloat(initialCash) : 0;
                      const cashSales = totalCashReceived - totalCashChange;
                      const totalCash = cashSales + initialCashValue;

                      const totalQris = sumByMethod('qris');
                      const totalCard = sumByMethod('card');
                      const totalNonCash = totalQris + totalCard;
                      const totalAll = totalCash + totalNonCash;

                      return (
                        <div className="mt-6 rounded-xl border border-border overflow-hidden">
                          <div className="bg-secondary/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
                            <p className="text-sm font-semibold flex items-center gap-2">
                              💰 Rincian Setoran Kas
                            </p>
                            <span className="text-xs text-muted-foreground">Total terkumpul: {formatCurrency(totalAll)}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">

                            {/* CASH — setoran langsung */}
                            <div className="p-4 bg-emerald-500/5">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">💵</span>
                                <div>
                                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Cash di Kasir</p>
                                  <p className="text-[10px] text-muted-foreground">Sesuai fisik laci kasir</p>
                                </div>
                              </div>
                              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalCash)}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                Modal: {formatCurrency(initialCashValue)}<br />
                                Jual: {formatCurrency(cashSales)}
                              </p>
                              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: totalAll > 0 ? `${(totalCash / totalAll) * 100}%` : '0%' }}
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {totalAll > 0 ? ((totalCash / totalAll) * 100).toFixed(1) : '0'}% dari total kas masuk
                              </p>
                            </div>

                            {/* QRIS */}
                            <div className="p-4 bg-blue-500/5">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📱</span>
                                <div>
                                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">QRIS / Transfer</p>
                                  <p className="text-[10px] text-muted-foreground">Masuk rekening — belum di tangan</p>
                                </div>
                              </div>
                              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalNonCash)}</p>
                              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all"
                                  style={{ width: totalAll > 0 ? `${(totalNonCash / totalAll) * 100}%` : '0%' }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {totalAll > 0 ? ((totalNonCash / totalAll) * 100).toFixed(1) : '0'}% dari total
                                {totalQris > 0 && totalCard > 0 && (
                                  <span className="ml-1">(QRIS {formatCurrency(totalQris)} + TF {formatCurrency(totalCard)})</span>
                                )}
                              </p>
                            </div>

                            {/* RINGKASAN */}
                            <div className="p-4 bg-secondary/10">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📊</span>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide">Kesimpulan</p>
                                  <p className="text-[10px] text-muted-foreground">Belanja dibayar dari kas</p>
                                </div>
                              </div>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Kas Masuk (Cash)</span>
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(totalCash)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Belanja (HPP)</span>
                                  <span className="font-medium text-warning">- {formatCurrency(totalShoppingHpp)}</span>
                                </div>
                                <div className="border-t border-border pt-1.5 flex justify-between font-bold">
                                  <span>Sisa Kas</span>
                                  <span className={totalCash - totalShoppingHpp >= 0 ? 'text-success' : 'text-destructive'}>
                                    {formatCurrency(totalCash - totalShoppingHpp)}
                                  </span>
                                </div>
                                {totalNonCash > 0 && (
                                  <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                                    <span>+ Rekening (TF/QRIS)</span>
                                    <span className="text-blue-500">{formatCurrency(totalNonCash)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          );
        })()}

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
                  <Bar dataKey="pendapatan" fill="#10b981" name="Pendapatan" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="hpp" fill="#f59e0b" name="HPP (Belanja)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="gaji" fill="#f97316" name="Gaji" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="profit" fill="#3b82f6" name="Profit Bersih" radius={[3, 3, 0, 0]} />
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

        {/* Menu Stats Table */}
        {menuStats.length > 0 && (() => {
          // Group menuStats by name for visual grouping
          const grouped: { name: string; items: any[] }[] = [];
          (menuStats as any[]).forEach((item) => {
            const existing = grouped.find(g => g.name === item.name);
            if (existing) {
              existing.items.push(item);
            } else {
              grouped.push({ name: item.name, items: [item] });
            }
          });

          return (
            <div className="card-elevated p-6 mb-8">
              <h3 className="font-display font-semibold text-lg mb-4">Ringkasan Penjualan Menu</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold">Nama Menu</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold">Variasi Kuah</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold">Tipe</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold">Terjual</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold">Total Penjualan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map((group, gIdx) => {
                      const groupTotal = group.items.reduce((a: number, i: any) => a + i.total, 0);
                      const groupQty = group.items.reduce((a: number, i: any) => a + i.quantity, 0);
                      const hasVariants = group.items.some((i: any) => i.kuahVariant);
                      const isMultiRow = group.items.length > 1;

                      return (
                        <React.Fragment key={`grp-${gIdx}`}>
                          {/* Group header row: shown when menu has multiple variant/tipe rows */}
                          {isMultiRow && (
                            <tr key={`group-${gIdx}`} className="bg-secondary/20 border-t-2 border-border">
                              <td className="py-2 px-4 text-sm font-bold text-foreground" colSpan={3}>
                                🍽️ {group.name}
                              </td>
                              <td className="py-2 px-4 text-sm text-right font-bold text-muted-foreground">{groupQty}</td>
                              <td className="py-2 px-4 text-sm text-right font-bold text-success">{formatCurrency(groupTotal)}</td>
                            </tr>
                          )}
                          {/* Sub-rows per variant + packaging type */}
                          {group.items.map((item: any, iIdx: number) => (
                            <tr
                              key={`${gIdx}-${iIdx}`}
                              className={`border-b border-border/60 hover:bg-secondary/50 ${isMultiRow ? 'bg-background' : ''}`}
                            >
                              {/* Show menu name only if single row (no grouping header) */}
                              {!isMultiRow ? (
                                <td className="py-3 px-4 text-sm font-medium">{item.name}</td>
                              ) : (
                                <td className="py-2.5 px-4 text-sm text-muted-foreground pl-8">↳</td>
                              )}
                              <td className="py-2.5 px-4 text-sm">
                                {item.kuahVariant ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700/50">
                                    🍜 {item.kuahVariant}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs italic">-</span>
                                )}
                              </td>
                              {/* Packaging type badge */}
                              <td className="py-2.5 px-4 text-sm">
                                {item.packagingType === 'Dibungkus' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50">
                                    📦 Dibungkus
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50">
                                    🍽️ Makan Disini
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-sm text-right font-medium">{item.quantity}</td>
                              <td className="py-2.5 px-4 text-sm text-right font-semibold text-success">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {/* Grand Total row */}
                    <tr className="bg-secondary/30 font-bold border-t-2 border-border">
                      <td className="py-3 px-4 text-sm" colSpan={3}>Total Keseluruhan</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {(menuStats as any[]).reduce((acc, curr) => acc + curr.quantity, 0)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-success">
                        {formatCurrency((menuStats as any[]).reduce((acc, curr) => acc + curr.total, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

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
                      <td className="py-3 px-4 text-sm font-mono">#{order.daily_number || order.id}</td>
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
                          : order.payment_status === 'paid'
                            ? 'bg-success/10 text-success'
                            : 'bg-warning/10 text-warning'
                          }`}>
                          {order.status === 'cancelled'
                            ? 'Dibatalkan'
                            : order.payment_status === 'paid'
                              ? 'Selesai'
                              : 'Belum Bayar'}
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
                              className="p-2 rounded-lg hover:bg-warning/10 text-warning"
                              onClick={() => handleEditOrder(order)}
                              title="Edit Pesanan"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {order.status !== 'cancelled' && (
                            <button
                              className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                              onClick={() => handleCancelOrder(order)}
                              title="Batalkan Pesanan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {(order.payment_method === 'qris' || order.payment_method === 'card') && order.status !== 'cancelled' && (
                            <button
                              className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-500 relative"
                              onClick={() => {
                                setSelectedProofOrder(order);
                                setShowPaymentProofDialog(true);
                              }}
                              title="Bukti Pembayaran"
                            >
                              <ImageIcon className="w-4 h-4" />
                              {order.payment_proof && order.payment_proof.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                  {order.payment_proof.length}
                                </span>
                              )}
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

          {/* Payment Summary */}
          {orders.length > 0 && (() => {
            const paidOrders = orders.filter(o => o.status !== 'cancelled' && o.payment_status === 'paid');

            // Use initial cash from localStorage (user input)
            const initialCashTotal = initialCash ? parseFloat(initialCash) : 0;

            const calculateMethodTotal = (method: string) => {
              return paidOrders.reduce((sum, o) => {
                let orderSum = 0;
                if (o.payment_method === method) orderSum += Number(o.paid_amount || 0);
                if (o.second_payment_method === method) orderSum += Number(o.second_paid_amount || 0);
                return sum + orderSum;
              }, 0);
            };

            const calculateMethodCount = (method: string) => {
              return paidOrders.reduce((count, o) => {
                let c = 0;
                if (o.payment_method === method) c++;
                if (o.second_payment_method === method) c++;
                return count + c;
              }, 0);
            };

            const cashSales = calculateMethodTotal('cash');
            const qrisTotal = calculateMethodTotal('qris');
            const cardTotal = calculateMethodTotal('card');

            const cashChange = paidOrders
              .reduce((sum, o) => {
                // Change is given only if Cash is involved? Usually yes.
                // Simplification: Change amount is stored in order. Assume it comes from Cash drawer.
                // Only subtract change if there was a cash payment?
                // If pay Qris then Cash, change likely from Cash.
                // If pay Cash then Qris?? Unlikely flow.
                // Safer: If any payment segment is cash, change comes from drawer.
                if (o.payment_method === 'cash' || o.second_payment_method === 'cash') {
                  return sum + Number(o.change_amount || 0);
                }
                return sum;
              }, 0);

            // Cash in register = Initial Cash + Cash Sales - Change Given
            const cashInRegister = initialCashTotal + cashSales - cashChange;

            const totalPaid = cashSales + qrisTotal + cardTotal;

            const cashCount = calculateMethodCount('cash');
            const qrisCount = calculateMethodCount('qris');
            const cardCount = calculateMethodCount('card');

            return (
              <div className="mt-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-display font-semibold text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Ringkasan Pembayaran
                  </h4>
                  <button
                    onClick={() => setShowInitialCashDialog(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                    title="Input Modal Awal Kasir"
                  >
                    <Edit2 className="w-4 h-4" />
                    {initialCash ? 'Edit Modal Awal' : 'Input Modal Awal'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Cash */}
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Cash</span>
                      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium">
                        {cashCount}x
                      </span>
                    </div>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(cashSales)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Uang tunai yang harus ada di kasir</p>
                  </div>

                  {/* QRIS */}
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">QRIS</span>
                      <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                        {qrisCount}x
                      </span>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(qrisTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pembayaran digital (cek rekening bank)</p>
                  </div>

                  {/* Card */}
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Card</span>
                      <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                        {cardCount}x
                      </span>
                    </div>
                    <p className="text-xl font-bold text-purple-600">{formatCurrency(cardTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pembayaran digital (cek rekening bank)</p>
                  </div>

                  {/* Total Terbayar */}
                  <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-primary">Total Terbayar</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                        {paidOrders.length}x
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalPaid)}</p>
                  </div>

                  {/* Cash in Register */}
                  <div className="bg-orange-500/10 rounded-lg p-4 border-2 border-orange-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-orange-600">Uang di Kasir</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(cashInRegister)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Modal: {formatCurrency(initialCashTotal)} + Penjualan: {formatCurrency(cashSales)} - Kembalian: {formatCurrency(cashChange)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Receipt Dialog */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Detail Transaksi</DialogTitle>
            </DialogHeader>

            <div className="flex justify-center gap-2 mb-2 bg-secondary/50 p-1 rounded-lg">
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${receiptMode === 'customer' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                onClick={() => setReceiptMode('customer')}
              >
                Struk Pelanggan
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${receiptMode === 'kitchen' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                onClick={() => setReceiptMode('kitchen')}
              >
                Nota Dapur
              </button>
            </div>

            <div id="receipt-preview" className="p-0">
              {receiptMode === 'kitchen' ? (
                // KITCHEN RECEIPT PREVIEW
                <div className="p-2 font-mono">
                  <div className="text-center mb-3 pb-2 border-b-2 border-dashed border-black">
                    <h2 className="text-xl font-bold">DAPUR</h2>
                    {selectedOrder && (
                      <>
                        <p className="text-lg font-bold">#{selectedOrder.daily_number || selectedOrder.id}</p>
                        <p className="uppercase text-sm font-bold mt-1">
                          {(selectedOrder as any).order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY'}
                        </p>
                        <p className="font-bold text-md mt-1 truncate">{selectedOrder.customer_name || 'Pelanggan'}</p>
                        <div className="text-[10px] mt-1 text-left flex justify-between">
                          <span>{new Date(selectedOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>Kasir: {selectedOrder.user?.name?.split(' ')[0]}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4">
                    {selectedOrder?.items?.map((item: any, idx: number) => {
                      // Skip if menu_item is null (deleted item)
                      if (!item.menu_item) return null;

                      return (
                        <div key={idx} className="border-b border-dashed border-black/20 pb-2 last:border-0">
                          <div className="flex gap-3 items-start">
                            <span className="font-bold text-2xl w-8 text-center leading-none mt-1">{item.quantity}</span>
                            <div className="flex-1">
                              <p className="font-bold text-xl leading-tight">
                                {generateKitchenCode(item.menu_item.name)}
                              </p>
                              <p className="text-[10px] text-muted-foreground leading-none mb-1">{item.menu_item.name}</p>

                              <div className="flex flex-wrap gap-1 mt-1">
                                {(item as any).is_takeaway && (
                                  <span className="font-bold text-xs border-2 border-black inline-block px-1 rounded-sm">BUNGKUS</span>
                                )}
                                {(item as any).note && (
                                  <span className="text-sm font-bold italic bg-black text-white px-1 rounded-sm">
                                    Note: {(item as any).note}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // CUSTOMER PREVIEW
                <>
                  {/* Header */}
                  <div className="text-center mb-2">
                    <div className="flex justify-center mb-1">
                      {selectedOrder?.store?.image ? (
                        <img
                          src={`${import.meta.env.VITE_API_URL || ''}/storage/${selectedOrder.store.image}`}
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
                          {selectedOrder.status === 'cancelled' ? 'BATAL' : (selectedOrder.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR')}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
                        {selectedOrder.items?.map((item: any, idx: number) => {
                          // Skip if menu_item is null (deleted item)
                          if (!item.menu_item) return null;

                          return (
                            <div key={idx} className="text-[10px] leading-tight">
                              <div className="font-bold flex items-center gap-1">
                                {item.menu_item.name}
                                {item.is_takeaway && <span className="text-[9px] uppercase font-normal border border-black px-0.5 rounded-sm">Bungkus</span>}
                              </div>
                              {item.note && <div className="italic text-[9px] mb-0.5">- {item.note}</div>}
                              <div className="flex justify-between">
                                <span>{item.quantity} x {formatCurrency(item.price)}</span>
                                <span className="font-semibold">{formatCurrency(item.quantity * item.price)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Totals */}
                      <div className="mb-2 text-[10px] space-y-0.5">
                        <div className="flex justify-between font-bold text-xs">
                          <span>TOTAL</span>
                          <span>{formatCurrency(selectedOrder.total)}</span>
                        </div>
                        {(selectedOrder as any).second_payment_method ? (
                          <>
                            <div className="text-center font-bold mt-1 mb-0.5 pt-0.5 border-t border-dashed border-black/30">
                              SPLIT BILL
                            </div>
                            <div className="flex justify-between">
                              <span className="uppercase">{(selectedOrder as any).payment_method}</span>
                              <span>{formatCurrency((selectedOrder as any).paid_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="uppercase">{(selectedOrder as any).second_payment_method}</span>
                              <span>{formatCurrency((selectedOrder as any).second_paid_amount)}</span>
                            </div>
                            {Number((selectedOrder as any).change_amount) > 0 && (
                              <div className="flex justify-between font-semibold mt-0.5 border-t border-dashed border-black/30 pt-0.5">
                                <span>Kembalian</span>
                                <span>{formatCurrency((selectedOrder as any).change_amount)}</span>
                              </div>
                            )}
                          </>
                        ) : (selectedOrder as any).paid_amount ? (
                          <>
                            <div className="flex justify-between">
                              <span>Dibayar ({(selectedOrder as any).payment_method?.toUpperCase()})</span>
                              <span>{formatCurrency((selectedOrder as any).paid_amount)}</span>
                            </div>
                            {Number((selectedOrder as any).change_amount) > 0 && (
                              <div className="flex justify-between font-semibold">
                                <span>Kembalian</span>
                                <span>{formatCurrency((selectedOrder as any).change_amount)}</span>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>

                      {/* Footer */}
                      <div className="text-center text-[10px] pt-1 border-t border-dashed border-black">
                        <p className="font-semibold mb-0.5">Terima Kasih</p>
                        <p className="text-[9px] leading-none">Powered by KedaiPOS</p>
                      </div>
                    </>
                  )}
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
                    <span className="font-mono font-semibold">#{orderToCancel.daily_number || orderToCancel.id}</span>
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

        {/* Payment Proof Dialog */}
        <Dialog open={showPaymentProofDialog} onOpenChange={setShowPaymentProofDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Bukti Pembayaran</DialogTitle>
            </DialogHeader>

            {selectedProofOrder && (
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ID Pesanan:</span>
                    <span className="font-mono font-semibold">#{selectedProofOrder.daily_number || selectedProofOrder.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{formatCurrency(selectedProofOrder.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Metode:</span>
                    <span className="uppercase font-semibold">{selectedProofOrder.payment_method}</span>
                  </div>
                </div>

                {/* Existing Proofs */}
                {selectedProofOrder.payment_proof && selectedProofOrder.payment_proof.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Bukti yang Sudah Diupload ({selectedProofOrder.payment_proof.length})</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedProofOrder.payment_proof.map((proof: string, index: number) => {
                        const imageUrl = `${import.meta.env.VITE_API_URL || ''}/storage/${proof}`;
                        console.log('Image URL:', imageUrl);
                        return (
                          <div key={index} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Bukti Pembayaran ${index + 1}`}
                              className="w-full h-48 object-cover rounded-lg border-2 border-border"
                              onError={(e) => {
                                console.error('Failed to load image:', imageUrl);
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EGagal Load%3C/text%3E%3C/svg%3E';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary text-sm"
                              >
                                Lihat Penuh
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upload New Proofs */}
                <div>
                  <h4 className="font-semibold mb-3">Upload Bukti Baru</h4>
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
                    onPaste={handlePasteImage}
                    tabIndex={0}
                  >
                    <input
                      type="file"
                      id="payment-proof-upload"
                      accept="image/*"
                      multiple
                      onChange={handleUploadPaymentProof}
                      className="hidden"
                      disabled={uploadingProof}
                    />
                    <label
                      htmlFor="payment-proof-upload"
                      className={`cursor-pointer flex flex-col items-center gap-2 ${uploadingProof ? 'opacity-50' : ''}`}
                    >
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {uploadingProof ? 'Mengupload...' : 'Klik untuk upload gambar'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Atau tekan Ctrl+V untuk paste gambar dari clipboard
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Maksimal 5 gambar, masing-masing max 5MB
                      </p>
                    </label>
                  </div>
                </div>

                <button
                  className="btn-outline w-full"
                  onClick={() => {
                    setShowPaymentProofDialog(false);
                    setSelectedProofOrder(null);
                  }}
                >
                  Tutup
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Hidden Print Receipt - Outside Dialog */}
        <div id="receipt-print" className="hidden">
          {selectedOrder && receiptMode === 'kitchen' ? (
            // KITCHEN PRINT
            <div className="p-1 font-mono">
              <div className="text-center mb-3 pb-2 border-b-2 border-dashed border-black">
                <h2 className="text-xl font-bold">DAPUR</h2>
                <p className="text-lg font-bold">#{selectedOrder.daily_number || selectedOrder.id}</p>
                <p className="uppercase text-sm font-bold mt-1">
                  {(selectedOrder as any).order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY'}
                </p>
                <p className="font-bold text-md mt-1 truncate">{selectedOrder.customer_name || 'Pelanggan'}</p>
                <div className="text-[10px] mt-1 text-left flex justify-between">
                  <span>{new Date(selectedOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{selectedOrder.user?.name?.split(' ')[0]}</span>
                </div>
              </div>
              <div className="space-y-4">
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="border-b border-dashed border-black/20 pb-2 last:border-0">
                    <div className="flex gap-3 items-start">
                      <span className="font-bold text-2xl w-8 text-center leading-none mt-1">{item.quantity}</span>
                      <div className="flex-1">
                        <p className="font-bold text-xl leading-tight">
                          {generateKitchenCode(item.menu_item.name)}
                        </p>
                        <p className="text-[10px] uppercase mb-1">{item.menu_item.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(item as any).is_takeaway && (
                            <span className="font-bold text-xs border border-black inline-block px-1">BUNGKUS</span>
                          )}
                          {(item as any).note && (
                            <span className="text-sm font-bold italic bg-black text-white px-1 print:bg-transparent print:text-black print:border-2 print:border-black print:not-italic" style={{ WebkitPrintColorAdjust: 'exact' }}>
                              Note: {(item as any).note}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedOrder && (
            // CUSTOMER PRINT
            <div className="p-0">
              <div className="text-center mb-2">
                <div className="flex justify-center mb-1">
                  {selectedOrder.store?.image ? (
                    <img
                      src={`${import.meta.env.VITE_API_URL || ''}/storage/${selectedOrder.store.image}`}
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
                  {selectedOrder.status === 'cancelled' ? 'BATAL' : (selectedOrder.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR')}
                </div>
              </div>

              <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="text-[10px] leading-tight">
                    <div className="font-bold flex items-center gap-1">
                      {item.menu_item.name}
                      {item.is_takeaway && <span className="text-[9px] uppercase font-normal border border-black px-0.5 rounded-sm">Bungkus</span>}
                    </div>
                    {item.note && <div className="italic text-[9px] mb-0.5">- {item.note}</div>}
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
                {(selectedOrder as any).second_payment_method ? (
                  <>
                    <div className="text-center font-bold mt-1 mb-0.5 pt-0.5 border-t border-dashed border-black/30">
                      SPLIT BILL
                    </div>
                    <div className="flex justify-between">
                      <span className="uppercase">{(selectedOrder as any).payment_method}</span>
                      <span>{formatCurrency((selectedOrder as any).paid_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="uppercase">{(selectedOrder as any).second_payment_method}</span>
                      <span>{formatCurrency((selectedOrder as any).second_paid_amount)}</span>
                    </div>
                    {Number((selectedOrder as any).change_amount) > 0 && (
                      <div className="flex justify-between font-semibold mt-0.5 border-t border-dashed border-black/30 pt-0.5">
                        <span>Kembalian</span>
                        <span>{formatCurrency((selectedOrder as any).change_amount)}</span>
                      </div>
                    )}
                  </>
                ) : (selectedOrder as any).paid_amount ? (
                  <>
                    <div className="flex justify-between">
                      <span>Dibayar ({(selectedOrder as any).payment_method?.toUpperCase()})</span>
                      <span>{formatCurrency((selectedOrder as any).paid_amount)}</span>
                    </div>
                    {Number((selectedOrder as any).change_amount) > 0 && (
                      <div className="flex justify-between font-semibold">
                        <span>Kembalian</span>
                        <span>{formatCurrency((selectedOrder as any).change_amount)}</span>
                      </div>
                    )}
                  </>
                ) : null}
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
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: white;
            font-weight: 600;
          }

          #receipt-print h1 {
            font-size: 16px;
            font-weight: 900;
            color: #000 !important;
          }

          #receipt-print h2 {
            font-weight: 900;
            color: #000 !important;
          }

          /* Ensure black and bold text for thermal printers */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000 !important;
            font-weight: 600 !important;
          }
          
          .text-muted-foreground {
            color: #000 !important;
            font-weight: 600 !important;
          }

          /* Make all text elements bolder */
          #receipt-print p,
          #receipt-print span,
          #receipt-print div {
            color: #000 !important;
            font-weight: 600 !important;
          }

          /* Extra bold for important elements */
          #receipt-print .font-bold,
          #receipt-print .font-semibold {
            font-weight: 900 !important;
          }

          /* Borders should be darker */
          #receipt-print .border-black,
          #receipt-print .border-dashed {
            border-color: #000 !important;
            border-width: 2px !important;
          }
        }
        
        #receipt-preview {
             font-family: 'Arial', sans-serif;
             border: 1px solid #eee;
        }
        `}</style>

        {/* Initial Cash Dialog */}
        <Dialog open={showInitialCashDialog} onOpenChange={setShowInitialCashDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Input Modal Awal Kasir</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Masukkan jumlah uang tunai yang ada di kasir saat memulai shift untuk tanggal <strong>{new Date(filters.start_date).toLocaleDateString('id-ID')}</strong>
              </p>
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Modal Awal (Rp)</label>
                <Input
                  type="number"
                  placeholder="Contoh: 100000"
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  className="text-lg"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInitialCashDialog(false)}
                  className="flex-1 btn-outline py-2"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    saveInitialCash(initialCash);
                    setShowInitialCashDialog(false);
                    toast.success('Modal awal kasir berhasil disimpan');
                  }}
                  className="flex-1 btn-primary py-2"
                >
                  Simpan
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout >
  );
}
