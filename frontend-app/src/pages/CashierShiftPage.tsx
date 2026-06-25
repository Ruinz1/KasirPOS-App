import React, { useState, useEffect } from 'react';
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
  Building2,
  Calendar,
  Banknote,
  Timer,
  Activity,
  Trash2,
  Plus,
  Edit,
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
  qris_sales: number | null;
  card_sales: number | null;
  paylater_sales: number | null;
  shopping_expenses: number | null;
  discrepancy: number | null;
  total_transactions: number | null;
  total_revenue: number | null;
  notes_open: string | null;
  notes_close: string | null;
  adjustments: Array<{ amount: number; notes: string; is_shopping: boolean }> | null;
  status: 'open' | 'closed';
  user: ShiftUser;
}

interface ShiftLiveData {
  total_transactions: number;
  total_revenue: number;
  cash_sales: number;
  cash_change: number;
  qris_sales: number;
  card_sales: number;
  paylater_sales: number;
  shopping_expenses: number;
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<CashierShift | null>(null);

  // Form state
  const [openingCash, setOpeningCash] = useState('');
  const [notesOpen, setNotesOpen] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notesClose, setNotesClose] = useState('');
  const [adjustments, setAdjustments] = useState<Array<{ amount: string; notes: string; is_shopping: boolean }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit Form state
  const [editOpeningCash, setEditOpeningCash] = useState('');
  const [editClosingCash, setEditClosingCash] = useState('');
  const [editNotesOpen, setEditNotesOpen] = useState('');
  const [editNotesClose, setEditNotesClose] = useState('');
  const [editStatus, setEditStatus] = useState<'open' | 'closed'>('open');
  const [editAdjustments, setEditAdjustments] = useState<Array<{ amount: string; notes: string; is_shopping: boolean }>>([]);

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

  // Reset adjustments on close modal toggle
  useEffect(() => {
    if (!showCloseDialog) {
      setClosingCash('');
      setNotesClose('');
      setAdjustments([]);
    }
  }, [showCloseDialog]);

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

    // Calculations based on local input + adjustments
    const totalShoppingAdjustments = adjustments
      .filter(adj => adj.is_shopping)
      .reduce((sum, adj) => sum + (Number(adj.amount) || 0), 0);

    const expectedPreview = (liveData?.expected_cash || 0) - totalShoppingAdjustments;
    const diff = Number(closingCash) - expectedPreview;

    if (Math.abs(diff) > 1000 && !notesClose.trim()) {
      toast.error('Catatan wajib diisi jika ada selisih uang lebih dari Rp 1.000');
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/cashier-shifts/${activeShift!.id}/close`, {
        closing_cash: Number(closingCash),
        notes_close: notesClose || null,
        adjustments: adjustments.map(adj => ({
          amount: Number(adj.amount) || 0,
          notes: adj.notes,
          is_shopping: !!adj.is_shopping,
        })),
      });
      toast.success('Shift berhasil ditutup! Terima kasih atas kerja kerasnya 🎉');
      setShowCloseDialog(false);
      setClosingCash('');
      setNotesClose('');
      setAdjustments([]);
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

  const openEditShift = (shift: CashierShift) => {
    setEditingShift(shift);
    setEditOpeningCash(String(shift.opening_cash));
    setEditClosingCash(shift.closing_cash !== null ? String(shift.closing_cash) : '');
    setEditNotesOpen(shift.notes_open || '');
    setEditNotesClose(shift.notes_close || '');
    setEditStatus(shift.status);
    setEditAdjustments(
      shift.adjustments
        ? shift.adjustments.map(adj => ({
            amount: String(adj.amount),
            notes: adj.notes || '',
            is_shopping: !!adj.is_shopping,
          }))
        : []
    );
    setShowEditDialog(true);
  };

  const handleEditShift = async () => {
    if (!editingShift) return;

    if (!editOpeningCash || Number(editOpeningCash) < 0) {
      toast.error('Masukkan jumlah modal awal yang valid');
      return;
    }

    if (editStatus === 'closed' && (!editClosingCash || Number(editClosingCash) < 0)) {
      toast.error('Masukkan jumlah uang fisik di laci kasir jika shift ditutup');
      return;
    }

    const payload: any = {
      opening_cash: Number(editOpeningCash),
      notes_open: editNotesOpen || null,
      status: editStatus,
      adjustments: editAdjustments.map(adj => ({
        amount: Number(adj.amount) || 0,
        notes: adj.notes,
        is_shopping: !!adj.is_shopping,
      })),
    };

    if (editStatus === 'closed') {
      payload.closing_cash = Number(editClosingCash);
      payload.notes_close = editNotesClose || null;
    }

    setSubmitting(true);
    try {
      await api.put(`/cashier-shifts/${editingShift.id}`, payload);
      toast.success('Shift berhasil diperbarui!');
      setShowEditDialog(false);
      await fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus shift ini? Semua data terkait (termasuk belanja harian yang diinput otomatis dari shift ini) juga akan dihapus secara permanen.')) {
      return;
    }

    try {
      await api.delete(`/cashier-shifts/${shiftId}`);
      toast.success('Shift berhasil dihapus!');
      await fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus shift');
    }
  };

  // ======================== ADJUSTMENTS LOGIC ========================

  const addAdjustment = () => {
    setAdjustments([...adjustments, { amount: '', notes: '', is_shopping: false }]);
  };

  const removeAdjustment = (index: number) => {
    setAdjustments(adjustments.filter((_, i) => i !== index));
  };

  const updateAdjustment = (index: number, key: string, value: any) => {
    setAdjustments(adjustments.map((item, i) => i === index ? { ...item, [key]: value } : item));
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

  const toggleRowExpand = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  // Pre-calculated expectations for current closing form
  const totalShoppingAdjustments = adjustments
    .filter(adj => adj.is_shopping)
    .reduce((sum, adj) => sum + (Number(adj.amount) || 0), 0);
  const expectedCashPreview = (liveData?.expected_cash || 0) - totalShoppingAdjustments;
  const currentDiscrepancy = closingCash ? Number(closingCash) - expectedCashPreview : null;

  const isOwnerOrAdmin = isAdmin() || user?.role === 'owner';

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
                      Kasir: <strong className="text-primary-foreground font-semibold">{activeShift.user?.name}</strong> • Dibuka: {formatDateTime(activeShift.opened_at)} • Durasi: {calculateDuration(activeShift.opened_at)}
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
                            <span className="text-xs text-muted-foreground text-blue-600">QRIS/TF</span>
                            <p className="font-bold text-sm text-blue-600">{formatCurrency(liveData.qris_sales)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground text-purple-600">Kartu</span>
                            <p className="font-bold text-sm text-purple-600">{formatCurrency(liveData.card_sales)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground text-amber-600">Paylater</span>
                            <p className="font-bold text-sm text-amber-600">{formatCurrency(liveData.paylater_sales)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground text-orange-600">Belanja</span>
                            <p className="font-bold text-sm text-orange-600">-{formatCurrency(liveData.shopping_expenses)}</p>
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
                <div className="flex gap-2">
                  {isOwnerOrAdmin && (
                    <Button variant="outline" size="sm" onClick={() => openEditShift(activeShift)}>
                      <Edit className="w-4 h-4 mr-2" /> Edit Shift
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowCloseDialog(true)}
                    className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    Tutup Shift
                  </Button>
                </div>
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
                      <React.Fragment key={shift.id}>
                        <tr
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
                          <tr>
                            <td colSpan={canEdit() ? 10 : 9} className="bg-muted/30 px-4 py-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground block mb-0.5">Total Transaksi</span>
                                  <p className="font-bold text-sm">{shift.total_transactions ?? '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5">Penjualan Cash</span>
                                  <p className="font-bold text-sm">{shift.cash_sales !== null ? formatCurrency(shift.cash_sales) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5 font-medium text-red-500">Kembalian</span>
                                  <p className="font-bold text-sm text-red-500">{shift.cash_change !== null ? formatCurrency(shift.cash_change) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5 text-blue-600">QRIS/TF</span>
                                  <p className="font-bold text-sm text-blue-600">{shift.qris_sales !== null ? formatCurrency(shift.qris_sales) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5 text-purple-600">Kartu</span>
                                  <p className="font-bold text-sm text-purple-600">{shift.card_sales !== null ? formatCurrency(shift.card_sales) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5 text-amber-600">Paylater</span>
                                  <p className="font-bold text-sm text-amber-600">{shift.paylater_sales !== null ? formatCurrency(shift.paylater_sales) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5 text-orange-600">Belanja</span>
                                  <p className="font-bold text-sm text-orange-600">-{shift.shopping_expenses !== null ? formatCurrency(shift.shopping_expenses) : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5">Expected Cash</span>
                                  <p className="font-bold text-sm">{shift.expected_cash !== null ? formatCurrency(shift.expected_cash) : '-'}</p>
                                </div>
                              </div>

                              {shift.adjustments && shift.adjustments.length > 0 && (
                                <div className="mt-3 border-t pt-3 max-w-md">
                                  <span className="text-muted-foreground text-xs font-semibold block mb-1">Daftar Penyesuaian/Keterangan Selisih:</span>
                                  <div className="space-y-1">
                                    {shift.adjustments.map((adj, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs bg-muted/65 p-1.5 rounded">
                                        <span className="flex items-center gap-1.5">
                                          {adj.notes || 'Penyesuaian'}
                                          {adj.is_shopping && (
                                            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 scale-90 border-0 h-4">Belanja</Badge>
                                          )}
                                        </span>
                                        <span className="font-mono font-semibold">{formatCurrency(adj.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(shift.notes_open || shift.notes_close) && (
                                <div className="mt-3 space-y-1 text-xs">
                                  {shift.notes_open && <p className="text-muted-foreground">📝 Buka: <span className="italic">{shift.notes_open}</span></p>}
                                  {shift.notes_close && <p className="text-muted-foreground">📝 Tutup: <span className="italic">{shift.notes_close}</span></p>}
                                </div>
                              )}

                              <div className="mt-3 flex gap-2">
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); viewShiftDetail(shift); }}>
                                  Lihat Detail Lengkap
                                </Button>
                                {isOwnerOrAdmin && (
                                  <>
                                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openEditShift(shift); }}>
                                      <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}>
                                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
                    <div className="flex justify-between col-span-2 border-b pb-1 font-semibold">
                      <span>Metode Pembayaran</span>
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
                      <span className="text-muted-foreground text-blue-600">QRIS / TF</span>
                      <span className="font-medium text-blue-600">{formatCurrency(liveData.qris_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-purple-600">Kartu</span>
                      <span className="font-medium text-purple-600">{formatCurrency(liveData.card_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-amber-600 font-medium">Paylater</span>
                      <span className="font-medium text-amber-600">{formatCurrency(liveData.paylater_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-orange-600 font-medium">Belanja (Sistem)</span>
                      <span className="font-medium text-orange-600">-{formatCurrency(liveData.shopping_expenses)}</span>
                    </div>
                    {totalShoppingAdjustments > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orange-600 font-bold">Belanja Baru (Form)</span>
                        <span className="font-bold text-orange-600">-{formatCurrency(totalShoppingAdjustments)}</span>
                      </div>
                    )}
                    <div className="flex justify-between col-span-2 border-t pt-1">
                      <span className="text-muted-foreground">Modal Awal</span>
                      <span className="font-medium">{formatCurrency(activeShift.opening_cash)}</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">Total Penjualan (Omzet)</span>
                      <span className="font-bold text-primary">{formatCurrency(liveData.total_revenue)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-semibold text-sm">Expected Cash di Laci</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">
                      {formatCurrency(expectedCashPreview)}
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
              {closingCash && liveData && currentDiscrepancy !== null && (
                <div className={`rounded-lg border p-3 ${
                  currentDiscrepancy === 0
                    ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                    : currentDiscrepancy > 0
                    ? 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20'
                    : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-2">
                      {currentDiscrepancy === 0 ? (
                        <><CheckCircle2 className="w-4 h-4 text-green-600" /> Kas Cocok!</>
                      ) : currentDiscrepancy > 0 ? (
                        <><TrendingUp className="w-4 h-4 text-yellow-600" /> Kas Lebih</>
                      ) : (
                        <><TrendingDown className="w-4 h-4 text-red-600" /> Kas Kurang</>
                      )}
                    </span>
                    <span className={`font-bold text-lg ${getDiscrepancyColor(currentDiscrepancy)}`}>
                      {formatCurrency(currentDiscrepancy)}
                    </span>
                  </div>
                </div>
              )}

              {/* Adjustments Section */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm font-bold">Penyesuaian / Keterangan Selisih</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAdjustment}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Gunakan untuk paylater atau belanja. Centang "Belanja" jika diambil dari laci cash agar mengurangi expected cash.
                </p>
                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                  {adjustments.map((adj, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-muted/40 p-2 rounded border">
                      <div className="w-[110px]">
                        <Input
                          type="number"
                          placeholder="Nominal"
                          value={adj.amount}
                          onChange={(e) => updateAdjustment(idx, 'amount', e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="Contoh: Paylater Meja 5"
                          value={adj.notes}
                          onChange={(e) => updateAdjustment(idx, 'notes', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id={`shopping-${idx}`}
                          checked={adj.is_shopping}
                          onChange={(e) => updateAdjustment(idx, 'is_shopping', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary"
                        />
                        <Label htmlFor={`shopping-${idx}`} className="text-xs select-none">Belanja</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => removeAdjustment(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-sm font-medium">
                  Catatan Tutup Shift
                  {closingCash && liveData && currentDiscrepancy !== null && Math.abs(currentDiscrepancy) > 1000 && (
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

        {/* ===== DIALOG: EDIT SHIFT ===== */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" />
                Edit Shift Kasir
              </DialogTitle>
            </DialogHeader>
            {editingShift && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Status Shift</Label>
                    <Select value={editStatus} onValueChange={(v: 'open' | 'closed') => setEditStatus(v)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aktif / Buka</SelectItem>
                        <SelectItem value="closed">Selesai / Tutup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Modal Awal (Rp)</Label>
                    <Input
                      type="number"
                      value={editOpeningCash}
                      onChange={(e) => setEditOpeningCash(e.target.value)}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                </div>

                {editStatus === 'closed' && (
                  <div>
                    <Label className="text-sm font-medium">Uang Aktual di Laci (Rp)</Label>
                    <Input
                      type="number"
                      value={editClosingCash}
                      onChange={(e) => setEditClosingCash(e.target.value)}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Catatan Buka Shift</Label>
                  <Textarea
                    value={editNotesOpen}
                    onChange={(e) => setEditNotesOpen(e.target.value)}
                    className="mt-1.5"
                    rows={2}
                  />
                </div>

                {editStatus === 'closed' && (
                  <div>
                    <Label className="text-sm font-medium">Catatan Tutup Shift</Label>
                    <Textarea
                      value={editNotesClose}
                      onChange={(e) => setEditNotesClose(e.target.value)}
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>
                )}

                {/* Adjustments Section in Edit */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm font-bold">Penyesuaian / Keterangan Selisih</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditAdjustments([...editAdjustments, { amount: '', notes: '', is_shopping: false }])}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Gunakan untuk paylater atau belanja. Centang "Belanja" jika diambil dari laci cash agar mengurangi expected cash.
                  </p>
                  <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                    {editAdjustments.map((adj, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-muted/30 p-2 rounded border">
                        <div className="w-[110px]">
                          <Input
                            type="number"
                            placeholder="Nominal"
                            value={adj.amount}
                            onChange={(e) => {
                              const updated = [...editAdjustments];
                              updated[idx].amount = e.target.value;
                              setEditAdjustments(updated);
                            }}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="Contoh: Paylater Customer"
                            value={adj.notes}
                            onChange={(e) => {
                              const updated = [...editAdjustments];
                              updated[idx].notes = e.target.value;
                              setEditAdjustments(updated);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id={`edit-shopping-${idx}`}
                            checked={adj.is_shopping}
                            onChange={(e) => {
                              const updated = [...editAdjustments];
                              updated[idx].is_shopping = e.target.checked;
                              setEditAdjustments(updated);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary"
                          />
                          <Label htmlFor={`edit-shopping-${idx}`} className="text-xs select-none">Belanja</Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setEditAdjustments(editAdjustments.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)} disabled={submitting}>
                    Batal
                  </Button>
                  <Button className="flex-1 animate-pulse bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleEditShift} disabled={submitting}>
                    {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===== DIALOG: DETAIL SHIFT ===== */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Detail Shift Kasir</DialogTitle>
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
                      <p className="font-bold text-sm">{formatCurrency(detailShift.opening_cash)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Total Omzet</span>
                      <p className="font-bold text-sm text-primary">{detailShift.total_revenue !== null ? formatCurrency(detailShift.total_revenue) : '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Penjualan Cash</span>
                      <p className="font-medium text-sm">{detailShift.cash_sales !== null ? formatCurrency(detailShift.cash_sales) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs text-red-500">Kembalian Cash</span>
                      <p className="font-medium text-sm text-red-500">{detailShift.cash_change !== null ? `-${formatCurrency(detailShift.cash_change)}` : '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs text-blue-600 font-medium">Penjualan QRIS / TF</span>
                      <p className="font-medium text-sm text-blue-600">{detailShift.qris_sales !== null ? formatCurrency(detailShift.qris_sales) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs text-purple-600 font-medium">Penjualan Kartu</span>
                      <p className="font-medium text-sm text-purple-600">{detailShift.card_sales !== null ? formatCurrency(detailShift.card_sales) : '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs text-amber-600 font-medium">Paylater / Pending</span>
                      <p className="font-medium text-sm text-amber-600">{detailShift.paylater_sales !== null ? formatCurrency(detailShift.paylater_sales) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs text-orange-600 font-medium">Belanja dari Laci</span>
                      <p className="font-medium text-sm text-orange-600">-{detailShift.shopping_expenses !== null ? formatCurrency(detailShift.shopping_expenses) : '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 p-3 text-sm bg-muted/30">
                    <div>
                      <span className="text-muted-foreground text-xs font-semibold">Expected Cash</span>
                      <p className="font-bold text-sm text-green-700 dark:text-green-400">{detailShift.expected_cash !== null ? formatCurrency(detailShift.expected_cash) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-semibold">Cash Aktual</span>
                      <p className="font-bold text-sm">{detailShift.closing_cash !== null ? formatCurrency(detailShift.closing_cash) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-semibold">Selisih</span>
                      <div className="mt-0.5">{getDiscrepancyBadge(detailShift.discrepancy)}</div>
                    </div>
                  </div>
                </div>

                {detailShift.adjustments && detailShift.adjustments.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <span className="text-xs text-muted-foreground font-semibold block mb-1">Daftar Penyesuaian/Keterangan Selisih:</span>
                    <div className="space-y-1">
                      {detailShift.adjustments.map((adj, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-muted/50 p-2 rounded">
                          <span className="flex items-center gap-1.5">
                            {adj.notes || 'Penyesuaian'}
                            {adj.is_shopping && (
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 scale-90 border-0 h-4">Belanja</Badge>
                            )}
                          </span>
                          <span className="font-mono font-semibold">{formatCurrency(adj.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

                {isOwnerOrAdmin && (
                  <div className="flex gap-2 pt-2 border-t justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setShowDetailDialog(false); openEditShift(detailShift); }}>
                      <Edit className="w-3.5 h-3.5 mr-1" /> Edit Shift
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { setShowDetailDialog(false); handleDeleteShift(detailShift.id); }}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus Shift
                    </Button>
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
