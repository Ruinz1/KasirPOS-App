/**
 * InventoryReportTab — Tab Laporan Bahan Baku & Overhead Harian
 * Diintegrasikan ke dalam ReportsPage.tsx
 */
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { formatCurrency } from '@/utils/calculations';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, TrendingDown, Plus, Trash2, ChevronDown, ChevronUp,
  BarChart2, AlertCircle, CalendarDays, RefreshCw
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  current_stock: number;
  price_per_unit: number;
}

interface UsageSummaryItem {
  inventory_item_id: number;
  name: string;
  unit: string;
  category: string;
  current_price: number;
  total_quantity: number;
  total_cost: number;
  order_count: number;
}

interface OverheadItem {
  id: number;
  inventory_item_id: number;
  date: string;
  quantity_used: number;
  unit: string;
  cost_amount: number;
  notes: string;
  inventory_item: InventoryItem;
  user?: { id: number; name: string };
}

interface DailyHistoryRow {
  usage_date: string;
  total_quantity: number;
  total_cost: number;
  order_count: number;
}

const CHART_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
];

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default function InventoryReportTab() {
  const today = new Date();

  // ── State ───────────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<'usage' | 'overhead'>('usage');

  // Usage Report
  const [startDate, setStartDate] = useState(today.toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ total_cost: number; total_quantity: number; ingredient_count: number } | null>(null);
  const [byIngredient, setByIngredient] = useState<UsageSummaryItem[]>([]);
  const [trend, setTrend] = useState<{ period: string; total_cost: number }[]>([]);

  // Item history drill-down
  const [selectedItem, setSelectedItem] = useState<UsageSummaryItem | null>(null);
  const [itemHistory, setItemHistory] = useState<DailyHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Overhead
  const [overheads, setOverheads] = useState<OverheadItem[]>([]);
  const [overheadSummary, setOverheadSummary] = useState<any[]>([]);
  const [overheadTotal, setOverheadTotal] = useState(0);
  const [loadingOverhead, setLoadingOverhead] = useState(false);
  const [showAddOverhead, setShowAddOverhead] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [overheadForm, setOverheadForm] = useState({
    inventory_item_id: '',
    date: today.toISOString().slice(0, 10),
    quantity_used: '',
    notes: '',
  });
  const [savingOverhead, setSavingOverhead] = useState(false);
  const [overheadMonth, setOverheadMonth] = useState(today.toISOString().slice(0, 7));

  // ── Fetch usage report ──────────────────────────────────────────
  const fetchUsageReport = useCallback(async () => {
    if (!startDate) return;
    setLoading(true);
    try {
      const [year, month] = startDate.split('-').map(Number);
      const { start, end } = getMonthRange(year, month);
      const res = await api.get('/inventory-reports/usage', {
        params: { start_date: start, end_date: end, group_by: 'day' },
      });
      setSummary(res.data.summary);
      setByIngredient(res.data.by_ingredient);
      setTrend(res.data.trend);
    } catch {
      toast.error('Gagal memuat laporan pemakaian bahan');
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => { fetchUsageReport(); }, [fetchUsageReport]);

  // ── Fetch item daily history ────────────────────────────────────
  const fetchItemHistory = useCallback(async (item: UsageSummaryItem) => {
    setSelectedItem(item);
    setLoadingHistory(true);
    try {
      const [year, month] = startDate.split('-').map(Number);
      const { start, end } = getMonthRange(year, month);
      const res = await api.get(`/inventory-reports/${item.inventory_item_id}/daily-usage`, {
        params: { start_date: start, end_date: end },
      });
      setItemHistory(res.data.order_usage);
    } catch {
      toast.error('Gagal memuat histori bahan');
    } finally {
      setLoadingHistory(false);
    }
  }, [startDate]);

  // ── Fetch overheads ─────────────────────────────────────────────
  const fetchOverheads = useCallback(async () => {
    if (!overheadMonth) return;
    setLoadingOverhead(true);
    try {
      const [year, month] = overheadMonth.split('-').map(Number);
      const { start, end } = getMonthRange(year, month);
      const res = await api.get('/inventory/overheads', {
        params: { start_date: start, end_date: end },
      });
      setOverheads(res.data.overheads);
      setOverheadSummary(res.data.summary);
      setOverheadTotal(res.data.total_cost);
    } catch {
      toast.error('Gagal memuat overhead');
    } finally {
      setLoadingOverhead(false);
    }
  }, [overheadMonth]);

  const fetchInventoryItems = useCallback(async () => {
    try {
      const res = await api.get('/inventory', { params: { type: 'stock' } });
      setInventoryItems(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'overhead') {
      fetchOverheads();
      fetchInventoryItems();
    }
  }, [activeSubTab, fetchOverheads, fetchInventoryItems]);

  // ── Add Overhead ────────────────────────────────────────────────
  const handleAddOverhead = async () => {
    if (!overheadForm.inventory_item_id || !overheadForm.quantity_used) {
      toast.error('Pilih bahan dan masukkan jumlah');
      return;
    }
    setSavingOverhead(true);
    try {
      await api.post('/inventory/overheads', {
        inventory_item_id: Number(overheadForm.inventory_item_id),
        date: overheadForm.date,
        quantity_used: Number(overheadForm.quantity_used),
        notes: overheadForm.notes,
      });
      toast.success('Overhead berhasil dicatat');
      setShowAddOverhead(false);
      setOverheadForm({ inventory_item_id: '', date: today.toISOString().slice(0, 10), quantity_used: '', notes: '' });
      fetchOverheads();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mencatat overhead');
    } finally {
      setSavingOverhead(false);
    }
  };

  const handleDeleteOverhead = async (id: number) => {
    if (!confirm('Hapus overhead ini? Stok akan dikembalikan.')) return;
    try {
      await api.delete(`/inventory/overheads/${id}`);
      toast.success('Overhead dihapus dan stok dikembalikan');
      fetchOverheads();
    } catch {
      toast.error('Gagal menghapus overhead');
    }
  };

  const selectedInventoryItem = inventoryItems.find(i => i.id === Number(overheadForm.inventory_item_id));
  const estimatedCost = selectedInventoryItem && overheadForm.quantity_used
    ? Number(overheadForm.quantity_used) * selectedInventoryItem.price_per_unit
    : 0;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Sub-tab nav */}
      <div className="flex gap-2 border-b border-border">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSubTab === 'usage' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveSubTab('usage')}
        >
          <Package className="h-4 w-4" /> Pemakaian Bahan
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSubTab === 'overhead' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveSubTab('overhead')}
        >
          <TrendingDown className="h-4 w-4" /> Overhead Harian
        </button>
      </div>

      {/* ── USAGE REPORT ── */}
      {activeSubTab === 'usage' && (
        <div className="space-y-6">
          {/* Filter + Refresh */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Input type="month" className="w-44" value={startDate}
                onChange={e => setStartDate(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={fetchUsageReport} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Total Biaya Bahan Bulan Ini</p>
                <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(summary.total_cost)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Jumlah Jenis Bahan Dipakai</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{summary.ingredient_count}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Rata-rata Biaya per Hari</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(summary.total_cost / Math.max(1, trend.length))}
                </p>
              </div>
            </div>
          ) : null}

          {/* Chart tren biaya harian */}
          {trend.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4" /> Tren Biaya Harian
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={trend} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }}
                    tickFormatter={v => v.slice(8)} />
                  <YAxis tick={{ fontSize: 10 }}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} labelFormatter={l => `Tgl ${l.slice(8)}`} />
                  <Bar dataKey="total_cost" name="Biaya Bahan" radius={[3, 3, 0, 0]}>
                    {trend.map((_, i) => <Cell key={i} fill="#f59e0b" fillOpacity={0.8} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table per bahan */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <p className="font-semibold text-sm">Pemakaian per Bahan (klik untuk detail harian)</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : byIngredient.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada data pemakaian bahan bulan ini</p>
                <p className="text-xs mt-1">Data akan tercatat otomatis saat ada transaksi order</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Bahan</th>
                      <th className="text-right p-3 font-medium">Total Pakai</th>
                      <th className="text-right p-3 font-medium">Biaya</th>
                      <th className="text-right p-3 font-medium">Harga/unit</th>
                      <th className="text-right p-3 font-medium">Transaksi</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {byIngredient.map((item, idx) => {
                      const isSelected = selectedItem?.inventory_item_id === item.inventory_item_id;
                      return (
                        <>
                          <tr key={item.inventory_item_id}
                            className={`border-t border-border cursor-pointer hover:bg-secondary/30 transition-colors ${isSelected ? 'bg-amber-50' : ''}`}
                            onClick={() => isSelected ? setSelectedItem(null) : fetchItemHistory(item)}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                <span className="font-medium">{item.name}</span>
                                <span className="text-xs text-muted-foreground">({item.category})</span>
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono">
                              {item.total_quantity.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item.unit}
                            </td>
                            <td className="p-3 text-right font-bold text-orange-700">
                              {formatCurrency(item.total_cost)}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatCurrency(item.current_price)}/{item.unit}
                            </td>
                            <td className="p-3 text-right">{item.order_count}x</td>
                            <td className="p-3">
                              {isSelected ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </td>
                          </tr>

                          {/* Expandable: daily history */}
                          {isSelected && (
                            <tr key={`hist-${item.inventory_item_id}`}>
                              <td colSpan={6} className="bg-amber-50/50 p-0">
                                <div className="p-3 border-t border-amber-200">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Histori Harian — {item.name}</p>
                                  {loadingHistory ? (
                                    <div className="space-y-1.5">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-7" />)}</div>
                                  ) : itemHistory.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-3">Tidak ada data</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {itemHistory.map(row => (
                                        <div key={row.usage_date} className="flex items-center justify-between text-xs p-2 rounded bg-white border border-amber-100">
                                          <span className="text-muted-foreground">{new Date(row.usage_date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                                          <span className="font-medium">{Number(row.total_quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item.unit}</span>
                                          <span className="text-orange-700 font-bold">{formatCurrency(row.total_cost)}</span>
                                          <span className="text-muted-foreground">{row.order_count} order</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-secondary/30 border-t-2 border-border">
                    <tr>
                      <td className="p-3 font-bold">TOTAL</td>
                      <td className="p-3 text-right font-mono">—</td>
                      <td className="p-3 text-right font-bold text-orange-700">{formatCurrency(summary?.total_cost ?? 0)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OVERHEAD TAB ── */}
      {activeSubTab === 'overhead' && (
        <div className="space-y-6">
          {/* Header & Add Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Input type="month" className="w-44" value={overheadMonth}
                onChange={e => setOverheadMonth(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchOverheads} disabled={loadingOverhead}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingOverhead ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setShowAddOverhead(true)}>
                <Plus className="h-4 w-4" /> Catat Overhead
              </Button>
            </div>
          </div>

          {/* Summary per bahan */}
          {overheadSummary.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-3 border-b border-border flex justify-between items-center">
                <p className="font-semibold text-sm">Rekap Overhead Bulan Ini</p>
                <span className="font-bold text-orange-700">{formatCurrency(overheadTotal)}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Bahan</th>
                    <th className="text-right p-3 font-medium">Total</th>
                    <th className="text-right p-3 font-medium">Biaya</th>
                    <th className="text-right p-3 font-medium">Entri</th>
                  </tr>
                </thead>
                <tbody>
                  {overheadSummary.map(row => (
                    <tr key={row.inventory_item_id} className="border-t border-border">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-right">{Number(row.total_quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.unit}</td>
                      <td className="p-3 text-right font-bold text-orange-700">{formatCurrency(row.total_cost)}</td>
                      <td className="p-3 text-right text-muted-foreground">{row.entry_count}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overhead entries */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 border-b border-border">
              <p className="font-semibold text-sm">Detail Entri Overhead</p>
            </div>
            {loadingOverhead ? (
              <div className="p-4 space-y-2">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : overheads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <TrendingDown className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada catatan overhead bulan ini</p>
                <p className="text-xs mt-1">Catat pemakaian bahan tetap seperti kuah, gas LPG, dll</p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowAddOverhead(true)}>
                  <Plus className="h-3.5 w-3.5" /> Catat Sekarang
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Tanggal</th>
                      <th className="text-left p-3 font-medium">Bahan</th>
                      <th className="text-right p-3 font-medium">Jumlah</th>
                      <th className="text-right p-3 font-medium">Biaya</th>
                      <th className="text-left p-3 font-medium">Catatan</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {overheads.map(o => (
                      <tr key={o.id} className="border-t border-border hover:bg-secondary/20">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(o.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </td>
                        <td className="p-3 font-medium">{o.inventory_item?.name ?? '-'}</td>
                        <td className="p-3 text-right font-mono">{Number(o.quantity_used).toLocaleString('id-ID', { maximumFractionDigits: 3 })} {o.unit}</td>
                        <td className="p-3 text-right font-bold text-orange-700">{formatCurrency(o.cost_amount)}</td>
                        <td className="p-3 text-muted-foreground text-xs max-w-[160px] truncate">{o.notes || '-'}</td>
                        <td className="p-3">
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteOverhead(o.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/30 border-t-2 border-border">
                    <tr>
                      <td colSpan={3} className="p-3 font-bold">TOTAL</td>
                      <td className="p-3 text-right font-bold text-orange-700">{formatCurrency(overheadTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Overhead Dialog ── */}
      <Dialog open={showAddOverhead} onOpenChange={v => { setShowAddOverhead(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              Catat Overhead Harian
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Bahan *</p>
              <select
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                value={overheadForm.inventory_item_id}
                onChange={e => setOverheadForm(p => ({ ...p, inventory_item_id: e.target.value }))}
              >
                <option value="">— Pilih bahan —</option>
                {inventoryItems.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit}) — stok: {Number(i.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tanggal *</p>
                <Input type="date" value={overheadForm.date}
                  onChange={e => setOverheadForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Jumlah {selectedInventoryItem ? `(${selectedInventoryItem.unit})` : ''} *
                </p>
                <Input type="number" step="0.01" placeholder="misal: 60"
                  value={overheadForm.quantity_used}
                  onChange={e => setOverheadForm(p => ({ ...p, quantity_used: e.target.value }))} />
              </div>
            </div>

            {estimatedCost > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground text-xs">Estimasi biaya</p>
                <p className="font-bold text-orange-700 text-lg">{formatCurrency(estimatedCost)}</p>
                <p className="text-xs text-muted-foreground">
                  {overheadForm.quantity_used} {selectedInventoryItem?.unit} × {formatCurrency(selectedInventoryItem?.price_per_unit ?? 0)}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1">Catatan</p>
              <Input placeholder='misal: "kuah soto harian", "gas LPG"'
                value={overheadForm.notes}
                onChange={e => setOverheadForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Stok {selectedInventoryItem?.name ?? 'bahan'} akan dikurangi otomatis
            </p>

            <Button className="w-full" onClick={handleAddOverhead} disabled={savingOverhead}>
              {savingOverhead ? 'Menyimpan...' : 'Catat Overhead'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
