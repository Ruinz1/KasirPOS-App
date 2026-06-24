import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { formatCurrency } from '@/utils/calculations';
import {
  Clock,
  PlayCircle,
  StopCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Banknote,
  Timer,
  Activity,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ShiftUser {
  id: number;
  name: string;
  role: string;
}

interface CashierShift {
  id: number;
  user_id: number;
  store_id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_sales: number | null;
  cash_change: number | null;
  discrepancy: number | null;
  total_transactions: number | null;
  total_revenue: number | null;
  notes_open: string | null;
  notes_close: string | null;
  status: 'open' | 'closed';
  user: ShiftUser;
}

interface ShiftLiveData {
  total_transactions: number;
  total_revenue: number;
  cash_sales: number;
  cash_change: number;
  expected_cash: number;
}

interface ShiftSummary {
  total_shifts: number;
  closed_shifts: number;
  open_shifts: number;
  total_revenue: number;
  total_transactions: number;
  total_discrepancy: number;
  avg_discrepancy: number;
  negative_discrepancy_count: number;
}

interface Store {
  id: number;
  name: string;
}

export default function CashierShiftPage() {
  const { user, isAdmin, isKaryawan, canEdit, hasPermission, loading: authLoading } = useAuth();

  // Data state
  const [shifts, setShifts] = useState<CashierShift[]>([]);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [liveData, setLiveData] = useState<ShiftLiveData | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [employees, setEmployees] = useState<ShiftUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailShift, setDetailShift] = useState<CashierShift | null>(null);

  // Form state
  const [openingCash, setOpeningCash] = useState('');
  const [notesOpen, setNotesOpen] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notesClose, setNotesClose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMonthStart = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const [filters, setFilters] = useState({
    start_date: getMonthStart(),
    end_date: getLocalDateString(),
    user_id: '',
    store_id: '',
  });

  // Expanded rows in table
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // ======================== FETCH DATA ========================

  useEffect(() => {
    if (!authLoading && user && hasPermission('manage_orders')) {
      if (isAdmin()) {
        fetchStores();
      }
      fetchAll();
    } else if (!authLoading) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (!loading && hasPermission('manage_orders')) {
      fetchShifts();
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Poll active shift every 10 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!authLoading && user && hasPermission('manage_orders')) {
      interval = setInterval(() => {
        fetchActiveShift();
      }, 10000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchActiveShift(),
        fetchShifts(),
        fetchSummary(),
        fetchEmployees(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveShift = async () => {
    try {
      const res = await api.get('/cashier-shifts/active');
      if (res.data) {
        setActiveShift(res.data.shift);
        setLiveData(res.data.live_data);
      } else {
        setActiveShift(null);
        setLiveData(null);
      }
    } catch (err) {
      console.error('Failed to fetch active shift:', err);
    }
  };

  const fetchShifts = async () => {
    try {
      const params: any = {
        start_date: filters.start_date,
        end_date: filters.end_date,
      };
      if (filters.user_id && filters.user_id !== 'all') params.user_id = filters.user_id;
      if (isAdmin() && filters.store_id && filters.store_id !== 'all') params.store_id = filters.store_id;

      const res = await api.get('/cashier-shifts', { params });
      setShifts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const params: any = {
        start_date: filters.start_date,
        end_date: filters.end_date,
      };
      if (isAdmin() && filters.store_id && filters.store_id !== 'all') params.store_id = filters.store_id;

      const res = await api.get('/cashier-shifts/summary', { params });
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const params: any = {};
      if (isAdmin() && filters.store_id) params.store_id = filters.store_id;
      const res = await api.get('/employees', { params });
      setEmployees(res.data || []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await api.get('/stores-management');
      setStores(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    }
  };

  // ======================== ACTIONS ========================

  const handleOpenShift = async () => {
    if (!openingCash || Number(openingCash) < 0) {
      toast.error('Masukkan jumlah modal awal yang valid');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/cashier-shifts/open', {
        opening_cash: Number(openingCash),
        notes_open: notesOpen || null,
      });
      toast.success('Shift berhasil dibuka! Selamat bekerja 💪');
      setShowOpenDialog(false);
      setOpeningCash('');
      setNotesOpen('');
      await fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membuka shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!closingCash || Number(closingCash) < 0) {
      toast.error('Masukkan jumlah uang fisik di laci kasir');
      return;
    }

    // If there's a significant discrepancy, notes_close should be required
    if (liveData) {
      const expected = liveData.expected_cash;
      const diff = Number(closingCash) - expected;
      if (Math.abs(diff) > 1000 && !notesClose.trim()) {
        toast.error('Catatan wajib diisi jika ada selisih uang lebih dari Rp 1.000');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.put(`/cashier-shifts/${activeShift!.id}/close`, {
        closing_cash: Number(closingCash),
        notes_close: notesClose || null,
      });
      toast.success('Shift berhasil ditutup! Terima kasih atas kerja kerasnya 🎉');
      setShowCloseDialog(false);
      setClosingCash('');
      setNotesClose('');
      await fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menutup shift');
    } finally {
      setSubmitting(false);
    }
  };

  const viewShiftDetail = async (shift: CashierShift) => {
    try {
      const res = await api.get(`/cashier-shifts/${shift.id}`);
      setDetailShift(res.data.shift);
      setShowDetailDialog(true);
    } catch (err) {
      toast.error('Gagal memuat detail shift');
    }
  };

  const toggleRowExpand = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ======================== HELPERS ========================

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const calculateDuration = (openedAt: string, closedAt?: string | null) => {
    const start = new Date(openedAt).getTime();
    const end = closedAt ? new Date(closedAt).getTime() : Date.now();
    const diff = end - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}j ${minutes}m`;
  };

  const getDiscrepancyColor = (discrepancy: number | null) => {
    if (discrepancy === null) return 'text-muted-foreground';
    if (discrepancy === 0) return 'text-green-600 dark:text-green-400';
    if (discrepancy > 0) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getDiscrepancyBadge = (discrepancy: number | null) => {
    if (discrepancy === null) return null;
    if (discrepancy === 0) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Cocok</Badge>;
    }
    if (discrepancy > 0) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Lebih +{formatCurrency(discrepancy)}</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">Kurang {formatCurrency(discrepancy)}</Badge>;
  };

  // ======================== PERMISSION CHECK ========================

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!hasPermission('manage_orders')) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold">Akses Ditolak</h2>
            <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ======================== RENDER ========================

  return (
    <MainLayout>
      <div className="p-6 space-y-6">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              Shift Kasir
            </h1>
            <p className="text-muted-foreground mt-1">Kelola shift dan rekonsiliasi kas kasir</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchAll()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ===== ACTIVE SHIFT BANNER ===== */}
        {activeShift ? (
          <Card className="border-2 border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-6 h-6 text-green-600 dark:text-green-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-300">Shift Aktif</h3>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      Dibuka: {formatDateTime(activeShift.opened_at)} • Durasi: {calculateDuration(activeShift.opened_at)}
                    </p>
                    <div className="flex flex-wrap gap-4 mt-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Modal Awal</span>
                        <p className="font-bold text-sm">{formatCurrency(activeShift.opening_cash)}</p>
                      </div>
                      {liveData && (
                        <>
                          <div>
                            <span className="text-xs text-muted-foreground">Transaksi</span>
                            <p className="font-bold text-sm">{liveData.total_transactions}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Omzet</span>
                            <p className="font-bold text-sm">{formatCurrency(liveData.total_revenue)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Penjualan Cash</span>
                            <p className="font-bold text-sm">{formatCurrency(liveData.cash_sales)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Expected Cash</span>
                            <p className="font-bold text-sm text-green-700 dark:text-green-300">{formatCurrency(liveData.expected_cash)}</p>
                          </div>
                        </>
                      )}
                    </div>
                    {activeShift.notes_open && (
                      <p className="text-xs text-muted-foreground mt-2 italic">📝 {activeShift.notes_open}</p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setShowCloseDialog(true)}
                  className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
                >
                  <StopCircle className="w-4 h-4 mr-2" />
                  Tutup Shift
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Belum Ada Shift Aktif</h3>
                    <p className="text-sm text-muted-foreground">Buka shift terlebih dahulu untuk mulai bekerja</p>
                  </div>
                </div>
                <Button onClick={() => setShowOpenDialog(true)} className="flex-shrink-0">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Buka Shift Baru
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== SUMMARY CARDS ===== */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Shift</p>
                    <p className="text-xl font-bold">{summary.total_shifts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Omzet</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.total_revenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rata-rata Selisih</p>
                    <p className={`text-xl font-bold ${getDiscrepancyColor(summary.avg_discrepancy)}`}>
                      {formatCurrency(summary.avg_discrepancy)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Shift Minus</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{summary.negative_discrepancy_count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== FILTERS ===== */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs mb-1 block">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs mb-1 block">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                  className="h-9"
                />
              </div>
              {canEdit() && employees.length > 0 && (
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs mb-1 block">Kasir</Label>
                  <Select
                    value={filters.user_id || 'all'}
                    onValueChange={(v) => setFilters({ ...filters, user_id: v === 'all' ? '' : v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua Kasir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kasir</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isAdmin() && stores.length > 0 && (
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs mb-1 block">Toko</Label>
                  <Select
                    value={filters.store_id || 'all'}
                    onValueChange={(v) => setFilters({ ...filters, store_id: v === 'all' ? '' : v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua Toko" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Toko</SelectItem>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== SHIFT HISTORY TABLE ===== */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Timer className="w-5 h-5" />
              Riwayat Shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada riwayat shift</p>
                <p className="text-sm">Buka shift pertama Anda untuk mulai mencatat</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-3 font-medium">Tanggal</th>
                      {canEdit() && <th className="pb-3 pr-3 font-medium">Kasir</th>}
                      <th className="pb-3 pr-3 font-medium">Jam</th>
                      <th className="pb-3 pr-3 font-medium">Durasi</th>
                      <th className="pb-3 pr-3 font-medium text-right">Modal</th>
                      <th className="pb-3 pr-3 font-medium text-right">Omzet</th>
                      <th className="pb-3 pr-3 font-medium text-right">Expected</th>
                      <th className="pb-3 pr-3 font-medium text-right">Aktual</th>
                      <th className="pb-3 pr-3 font-medium text-center">Selisih</th>
                      <th className="pb-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <>
                        <tr
                          key={shift.id}
                          className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => toggleRowExpand(shift.id)}
                        >
                          <td className="py-3 pr-3">{formatDate(shift.opened_at)}</td>
                          {canEdit() && <td className="py-3 pr-3 font-medium">{shift.user?.name || '-'}</td>}
                          <td className="py-3 pr-3">
                            <span>{formatTime(shift.opened_at)}</span>
                            <span className="text-muted-foreground"> — </span>
                            <span>{shift.closed_at ? formatTime(shift.closed_at) : '...'}</span>
                          </td>
                          <td className="py-3 pr-3">{calculateDuration(shift.opened_at, shift.closed_at)}</td>
                          <td className="py-3 pr-3 text-right font-mono">{formatCurrency(shift.opening_cash)}</td>
                          <td className="py-3 pr-3 text-right font-mono">{shift.total_revenue !== null ? formatCurrency(shift.total_revenue) : '-'}</td>
                          <td className="py-3 pr-3 text-right font-mono">{shift.expected_cash !== null ? formatCurrency(shift.expected_cash) : '-'}</td>
                          <td className="py-3 pr-3 text-right font-mono">{shift.closing_cash !== null ? formatCurrency(shift.closing_cash) : '-'}</td>
                          <td className="py-3 pr-3 text-center">{getDiscrepancyBadge(shift.discrepancy)}</td>
                          <td className="py-3 text-center">
                            {shift.status === 'open' ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                                <Activity className="w-3 h-3 mr-1 animate-pulse" />Aktif
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Selesai</Badge>
                            )}
                          </td>
                        </tr>
                        {/* Expanded detail row */}
                        {expandedRows.has(shift.id) && (
                          <tr key={`detail-${shift.id}`}>
                            <td colSpan={canEdit() ? 10 : 9} className="bg-muted/30 px-4 py-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Total Transaksi</span>
                                  <p className="font-bold">{shift.total_transactions ?? '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Penjualan Cash</span>
                                  <p className="font-bold">{shift.cash_sales !== null ? formatCurrency(shift.cash_sales) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Total Kembalian</span>
                                  <p className="font-bold">{shift.cash_change !== null ? formatCurrency(shift.cash_change) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Selisih Nominal</span>
                                  <p className={`font-bold ${getDiscrepancyColor(shift.discrepancy)}`}>
                                    {shift.discrepancy !== null ? formatCurrency(shift.discrepancy) : '-'}
                                  </p>
                                </div>
                              </div>
                              {(shift.notes_open || shift.notes_close) && (
                                <div className="mt-3 space-y-1 text-xs">
                                  {shift.notes_open && <p className="text-muted-foreground">📝 Buka: <span className="italic">{shift.notes_open}</span></p>}
                                  {shift.notes_close && <p className="text-muted-foreground">📝 Tutup: <span className="italic">{shift.notes_close}</span></p>}
                                </div>
                              )}
                              <div className="mt-3">
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); viewShiftDetail(shift); }}>
                                  Lihat Detail Lengkap
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== DIALOG: BUKA SHIFT ===== */}
        <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-green-600" />
                Buka Shift Baru
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Masukkan jumlah uang tunai yang ada di laci kasir saat ini sebagai modal awal shift.
              </p>

              <div>
                <Label className="text-sm font-medium">Modal Awal (Rp) *</Label>
                <div className="relative mt-1.5">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Contoh: 200000"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="pl-10 text-lg"
                    autoFocus
                  />
                </div>
                {openingCash && (
                  <p className="text-xs text-muted-foreground mt-1">= {formatCurrency(Number(openingCash))}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">Catatan (Opsional)</Label>
                <Textarea
                  placeholder="Catatan tambahan saat buka shift..."
                  value={notesOpen}
                  onChange={(e) => setNotesOpen(e.target.value)}
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowOpenDialog(false)} disabled={submitting}>
                  Batal
                </Button>
                <Button className="flex-1" onClick={handleOpenShift} disabled={submitting}>
                  {submitting ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                  ) : (
                    <><PlayCircle className="w-4 h-4 mr-2" />Buka Shift</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== DIALOG: TUTUP SHIFT ===== */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <StopCircle className="w-5 h-5 text-red-600" />
                Tutup Shift
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Shift Summary */}
              {liveData && activeShift && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Ringkasan Shift
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Durasi Shift</span>
                      <span className="font-medium">{calculateDuration(activeShift.opened_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Transaksi</span>
                      <span className="font-medium">{liveData.total_transactions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Omzet</span>
                      <span className="font-bold">{formatCurrency(liveData.total_revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Penjualan Cash</span>
                      <span className="font-medium">{formatCurrency(liveData.cash_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kembalian Cash</span>
                      <span className="font-medium text-red-600 dark:text-red-400">-{formatCurrency(liveData.cash_change)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modal Awal</span>
                      <span className="font-medium">{formatCurrency(activeShift.opening_cash)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-semibold text-sm">Expected Cash di Laci</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">
                      {formatCurrency(liveData.expected_cash)}
                    </span>
                  </div>
                </div>
              )}

              {/* Input actual cash */}
              <div>
                <Label className="text-sm font-medium">Jumlah Uang Fisik di Laci (Rp) *</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Hitung uang tunai yang ada secara fisik di laci kasir saat ini</p>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Hitung uang di laci kasir..."
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    className="pl-10 text-lg"
                    autoFocus
                  />
                </div>
                {closingCash && (
                  <p className="text-xs text-muted-foreground mt-1">= {formatCurrency(Number(closingCash))}</p>
                )}
              </div>

              {/* Discrepancy preview */}
              {closingCash && liveData && (
                <div className={`rounded-lg border p-3 ${
                  Number(closingCash) - liveData.expected_cash === 0
                    ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                    : Number(closingCash) - liveData.expected_cash > 0
                    ? 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20'
                    : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-2">
                      {Number(closingCash) - liveData.expected_cash === 0 ? (
                        <><CheckCircle2 className="w-4 h-4 text-green-600" /> Kas Cocok!</>
                      ) : Number(closingCash) - liveData.expected_cash > 0 ? (
                        <><TrendingUp className="w-4 h-4 text-yellow-600" /> Kas Lebih</>
                      ) : (
                        <><TrendingDown className="w-4 h-4 text-red-600" /> Kas Kurang</>
                      )}
                    </span>
                    <span className={`font-bold text-lg ${getDiscrepancyColor(Number(closingCash) - liveData.expected_cash)}`}>
                      {formatCurrency(Number(closingCash) - liveData.expected_cash)}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-sm font-medium">
                  Catatan Tutup Shift
                  {closingCash && liveData && Math.abs(Number(closingCash) - liveData.expected_cash) > 1000 && (
                    <span className="text-red-500 ml-1">* (Wajib karena ada selisih)</span>
                  )}
                </Label>
                <Textarea
                  placeholder="Jelaskan jika ada selisih uang, atau catatan lainnya..."
                  value={notesClose}
                  onChange={(e) => setNotesClose(e.target.value)}
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCloseDialog(false)} disabled={submitting}>
                  Batal
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCloseShift}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                  ) : (
                    <><StopCircle className="w-4 h-4 mr-2" />Tutup Shift</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== DIALOG: DETAIL SHIFT ===== */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Detail Shift</DialogTitle>
            </DialogHeader>
            {detailShift && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{detailShift.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{detailShift.user?.role}</p>
                  </div>
                  <div className="ml-auto">
                    {detailShift.status === 'open' ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary">Selesai</Badge>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg divide-y">
                  <div className="grid grid-cols-2 gap-x-4 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Buka Shift</span>
                      <p className="font-medium">{formatDateTime(detailShift.opened_at)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Tutup Shift</span>
                      <p className="font-medium">{detailShift.closed_at ? formatDateTime(detailShift.closed_at) : '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Durasi</span>
                      <p className="font-medium">{calculateDuration(detailShift.opened_at, detailShift.closed_at)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Total Transaksi</span>
                      <p className="font-medium">{detailShift.total_transactions ?? '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Modal Awal</span>
                      <p className="font-bold">{formatCurrency(detailShift.opening_cash)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Total Omzet</span>
                      <p className="font-bold">{detailShift.total_revenue !== null ? formatCurrency(detailShift.total_revenue) : '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Penjualan Cash</span>
                      <p className="font-medium">{detailShift.cash_sales !== null ? formatCurrency(detailShift.cash_sales) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Kembalian Cash</span>
                      <p className="font-medium">{detailShift.cash_change !== null ? formatCurrency(detailShift.cash_change) : '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 p-3 text-sm bg-muted/30">
                    <div>
                      <span className="text-muted-foreground text-xs">Expected Cash</span>
                      <p className="font-bold">{detailShift.expected_cash !== null ? formatCurrency(detailShift.expected_cash) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Cash Aktual</span>
                      <p className="font-bold">{detailShift.closing_cash !== null ? formatCurrency(detailShift.closing_cash) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Selisih</span>
                      <div className="mt-0.5">{getDiscrepancyBadge(detailShift.discrepancy)}</div>
                    </div>
                  </div>
                </div>

                {(detailShift.notes_open || detailShift.notes_close) && (
                  <div className="border rounded-lg p-3 space-y-2 text-sm">
                    {detailShift.notes_open && (
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">📝 Catatan Buka Shift</span>
                        <p className="italic text-muted-foreground">{detailShift.notes_open}</p>
                      </div>
                    )}
                    {detailShift.notes_close && (
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">📝 Catatan Tutup Shift</span>
                        <p className="italic text-muted-foreground">{detailShift.notes_close}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
