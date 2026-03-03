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
  Wallet
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
      processChartData(orders);
    } else {
      setChartData([]);
    }
  }, [chartView, orders]);

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

      const [statsRes, ordersRes] = await Promise.all([
        api.get('/orders/report/sales', { params }),
        api.get('/orders', { params }),
      ]);

      setStats(statsRes.data);

      // Sort orders by created_at ascending (daily_number 1 first)
      const sortedOrders = (ordersRes.data || []).sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setOrders(sortedOrders);
      processChartData(sortedOrders);

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
      'Persentase Capaian': `${analysis.percentage.toFixed(2)}%`
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
                          src={`/storage/${selectedOrder.store.image}`}
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
                        const imageUrl = `/storage/${proof}`;
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
                      src={`/storage/${selectedOrder.store.image}`}
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
