import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Printer,
  Plus,
  Trash2,
  RefreshCw,
  User,
  Hash,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/calculations';

// ====================== TYPES ======================
interface MenuVariant {
  name: string;
  price: number;
  status: 'ready' | 'kosong' | 'pending';
  stock_deduction?: number;
  linked_ingredient_key?: string;
}

interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  status?: 'ready' | 'kosong' | 'pending';
  stock?: number | null;
  variants?: MenuVariant[];
}

interface OrderRow {
  id: string;
  menuItem: MenuItem | null;
  /** Nama variasi (dari `variants` menu) yang dicentang kasir sebagai ready. */
  variasi: string[];
  /** Ditandai habis oleh kasir: tetap tampil di layar, tapi tidak ikut dicetak. */
  habis: boolean;
  keterangan: string;
}

/** Variasi menu diambil dari data menu (kolom `variants`), bukan daftar hardcode. */
function getMenuVariants(item: MenuItem | null): MenuVariant[] {
  return item?.variants?.length ? item.variants : [];
}

function isVariantAvailable(variant: MenuVariant): boolean {
  return variant.status === 'ready';
}

const CATEGORY_GROUPS = {
  MAKANAN: ['makanan', 'bakso', 'food'],
  MINUMAN: ['minuman', 'drink', 'beverage', 'non-kopi', 'teh'],
  SNACK: ['snack', 'gorengan', 'cemilan'],
};

function getCategoryGroup(category: string): 'MAKANAN' | 'MINUMAN' | 'SNACK' | 'LAINNYA' {
  const lower = category?.toLowerCase() || '';
  if (CATEGORY_GROUPS.MAKANAN.some(c => lower.includes(c))) return 'MAKANAN';
  if (CATEGORY_GROUPS.MINUMAN.some(c => lower.includes(c))) return 'MINUMAN';
  if (CATEGORY_GROUPS.SNACK.some(c => lower.includes(c))) return 'SNACK';
  return 'LAINNYA';
}

function makeEmptyRow(id?: string): OrderRow {
  return {
    id: id ?? crypto.randomUUID(),
    menuItem: null,
    variasi: [],
    habis: false,
    keterangan: '',
  };
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const STORAGE_KEY = 'nota-pesanan-draft';

interface StoredDraft {
  customerName: string;
  tableNumber: string;
  orderRows: OrderRow[];
  minumanRows: OrderRow[];
}

function normalizeRow(row: Partial<OrderRow>): OrderRow {
  return {
    id: row.id ?? crypto.randomUUID(),
    menuItem: row.menuItem ?? null,
    variasi: row.variasi ?? [],
    habis: row.habis ?? false,
    keterangan: row.keterangan ?? '',
  };
}

function loadDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    return {
      ...parsed,
      orderRows: (parsed.orderRows ?? []).map(normalizeRow),
      minumanRows: (parsed.minumanRows ?? []).map(normalizeRow),
    };
  } catch {
    return null;
  }
}

const ROW_GRID = 'grid-cols-[50px_1fr_230px_140px_80px]';

// ====================== ORDER ROW ======================
interface OrderRowItemProps {
  row: OrderRow;
  index: number;
  total: number;
  accent: 'amber' | 'blue';
  pickerLabel: string;
  onMove: (direction: -1 | 1) => void;
  onOpenPicker: () => void;
  onToggleVariasi: (variantName: string) => void;
  onToggleHabis: () => void;
  onChangeKeterangan: (value: string) => void;
  onRemove: () => void;
}

function OrderRowItem({
  row, index, total, accent, pickerLabel,
  onMove, onOpenPicker, onToggleVariasi, onToggleHabis, onChangeKeterangan, onRemove,
}: OrderRowItemProps) {
  const variants = getMenuVariants(row.menuItem);
  const accentText = accent === 'amber'
    ? 'hover:text-amber-600 dark:hover:text-amber-400'
    : 'hover:text-blue-600 dark:hover:text-blue-400';
  const accentActive = accent === 'amber'
    ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400'
    : 'bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400';

  return (
    <div
      className={`grid ${ROW_GRID} border-t border-border transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'
        } ${row.habis ? 'opacity-50' : 'hover:bg-muted/60'}`}
    >
      {/* URUTAN */}
      <div className="px-2 py-2 flex items-center justify-center">
        <div className="flex flex-col items-center gap-0.5">
          <button
            className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Pindah ke atas"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <span className="font-bold text-sm w-6 text-center">{index + 1}</span>
          <button
            className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Pindah ke bawah"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* PESANAN */}
      <div className="px-2 py-2 flex items-center">
        {row.menuItem ? (
          <div className="w-full">
            <div
              className={`text-sm font-medium leading-tight cursor-pointer transition-colors ${accentText} ${row.habis ? 'line-through' : ''}`}
              onClick={onOpenPicker}
            >
              {row.menuItem.name}
            </div>
            <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
              <span>{formatCurrency(row.menuItem.price)}</span>
              {row.menuItem.stock != null && (
                <span className={row.menuItem.stock <= 0 ? 'text-destructive font-medium' : ''}>
                  · Stok: {row.menuItem.stock}
                </span>
              )}
              {row.habis && <span className="text-destructive font-medium">· Tidak dicetak</span>}
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenPicker}
            className={`w-full text-left text-muted-foreground text-sm transition-colors flex items-center gap-1.5 italic ${accentText}`}
          >
            <Plus className="w-3.5 h-3.5" />
            {pickerLabel}
          </button>
        )}
      </div>

      {/* VARIASI (dari data menu) */}
      <div className="px-2 py-2">
        {!row.menuItem ? (
          <span className="text-muted-foreground/60 text-xs italic">—</span>
        ) : variants.length === 0 ? (
          <span className="text-muted-foreground/60 text-xs italic">Tanpa variasi</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {variants.map((v, vIdx) => {
              const available = isVariantAvailable(v);
              const checked = row.variasi.includes(v.name);
              return (
                <button
                  key={`${v.name}-${vIdx}`}
                  onClick={() => available && onToggleVariasi(v.name)}
                  disabled={!available}
                  title={available ? undefined : `Variasi ${v.status}`}
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-all border ${!available
                    ? 'bg-muted border-border text-muted-foreground/50 line-through cursor-not-allowed'
                    : checked
                      ? accentActive
                      : 'bg-muted border-border text-muted-foreground hover:border-muted-foreground/50'
                    }`}
                >
                  {v.name}
                  {(v.price ?? 0) > 0 && ` (+${formatCurrency(v.price)})`}
                  {!available && ' (habis)'}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* KETERANGAN */}
      <div className="px-2 py-2 flex items-center">
        <Input
          value={row.keterangan}
          onChange={e => onChangeKeterangan(e.target.value)}
          placeholder="Catatan..."
          className="h-7 text-xs"
        />
      </div>

      {/* AKSI */}
      <div className="px-2 py-2 flex items-center justify-center gap-1">
        <button
          onClick={onToggleHabis}
          title={row.habis ? 'Tampilkan lagi di nota' : 'Tandai habis (tidak dicetak)'}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${row.habis
            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground'
            }`}
        >
          {row.habis ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onRemove}
          title="Hapus baris"
          className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ====================== MAIN COMPONENT ======================
export default function FoodOrderReceiptPage() {
  const { user } = useAuth();

  // Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [storeInfo, setStoreInfo] = useState({ name: 'BAKSO BENTO MALANG', address: '' });

  // Form (dipulihkan dari localStorage agar tidak reset saat refresh)
  const [customerName, setCustomerName] = useState(() => loadDraft()?.customerName ?? '');
  const [tableNumber, setTableNumber] = useState(() => loadDraft()?.tableNumber ?? '');
  const [orderRows, setOrderRows] = useState<OrderRow[]>(() => loadDraft()?.orderRows ?? [makeEmptyRow()]);
  const [minumanRows, setMinumanRows] = useState<OrderRow[]>(() => loadDraft()?.minumanRows ?? [makeEmptyRow()]);

  // UI state
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<'kuah' | 'mie' | 'menu' | null>(null);
  const [menuPickerOpen, setMenuPickerOpen] = useState(false);
  const [menuPickerTarget, setMenuPickerTarget] = useState<{ rowId: string; section: 'makanan' | 'minuman' } | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // ---- Fetch data ----
  useEffect(() => {
    fetchMenuItems();
    fetchStore();
  }, []);

  // ---- Persist draft ke localStorage agar tidak reset saat refresh ----
  useEffect(() => {
    const draft: StoredDraft = { customerName, tableNumber, orderRows, minumanRows };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [customerName, tableNumber, orderRows, minumanRows]);

  const fetchMenuItems = async () => {
    try {
      setLoadingMenu(true);
      const res = await api.get('/menu');
      const items: MenuItem[] = (res.data || []).filter(
        (item: MenuItem) => item.status !== 'kosong'
      );
      setMenuItems(items);
    } catch {
      toast.error('Gagal memuat menu');
    } finally {
      setLoadingMenu(false);
    }
  };

  const fetchStore = async () => {
    try {
      const res = await api.get('/store');
      setStoreInfo({ name: res.data.name || 'BAKSO BENTO MALANG', address: res.data.location || '' });
    } catch { /* ignore */ }
  };

  // ---- Helpers ----
  const makananItems = menuItems.filter(m => {
    const g = getCategoryGroup(m.category);
    return g === 'MAKANAN' || g === 'SNACK' || g === 'LAINNYA';
  });

  const minumanMenuItems = menuItems.filter(m => getCategoryGroup(m.category) === 'MINUMAN');

  // ---- Row management ----
  const updateMakananRow = (id: string, patch: Partial<OrderRow>) => {
    setOrderRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const updateMinumanRow = (id: string, patch: Partial<OrderRow>) => {
    setMinumanRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const addMakananRow = () => setOrderRows(prev => [...prev, makeEmptyRow()]);
  const addMinumanRow = () => setMinumanRows(prev => [...prev, makeEmptyRow()]);

  const removeMakananRow = (id: string) => {
    if (orderRows.length <= 1) { setOrderRows([makeEmptyRow()]); return; }
    setOrderRows(prev => prev.filter(r => r.id !== id));
  };

  const removeMinumanRow = (id: string) => {
    if (minumanRows.length <= 1) { setMinumanRows([makeEmptyRow()]); return; }
    setMinumanRows(prev => prev.filter(r => r.id !== id));
  };

  const makeVariasiToggler = (
    setRows: React.Dispatch<React.SetStateAction<OrderRow[]>>
  ) => (rowId: string, variantName: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const has = r.variasi.includes(variantName);
      return { ...r, variasi: has ? r.variasi.filter(v => v !== variantName) : [...r.variasi, variantName] };
    }));
  };

  const toggleMakananVariasi = makeVariasiToggler(setOrderRows);
  const toggleMinumanVariasi = makeVariasiToggler(setMinumanRows);

  const toggleMakananHabis = (rowId: string) => {
    setOrderRows(prev => prev.map(r => r.id === rowId ? { ...r, habis: !r.habis } : r));
  };

  const toggleMinumanHabis = (rowId: string) => {
    setMinumanRows(prev => prev.map(r => r.id === rowId ? { ...r, habis: !r.habis } : r));
  };

  const moveMakananRow = (index: number, direction: -1 | 1) => {
    setOrderRows(prev => moveItem(prev, index, direction));
  };

  const moveMinumanRow = (index: number, direction: -1 | 1) => {
    setMinumanRows(prev => moveItem(prev, index, direction));
  };

  // ---- Menu picker ----
  const openMenuPicker = (rowId: string, section: 'makanan' | 'minuman') => {
    setMenuPickerTarget({ rowId, section });
    setMenuSearch('');
    setMenuPickerOpen(true);
  };

  const selectMenu = (item: MenuItem) => {
    if (!menuPickerTarget) return;
    // Default: semua variasi yang ready langsung tercentang, variasi habis tidak.
    const patch: Partial<OrderRow> = {
      menuItem: item,
      variasi: getMenuVariants(item).filter(isVariantAvailable).map(v => v.name),
      habis: false,
    };
    if (menuPickerTarget.section === 'makanan') {
      updateMakananRow(menuPickerTarget.rowId, patch);
    } else {
      updateMinumanRow(menuPickerTarget.rowId, patch);
    }
    setMenuPickerOpen(false);
  };

  // Baris menyimpan salinan menu (ikut tersimpan di draft localStorage), yang bisa
  // basi kalau variasi/harga/stok diubah di halaman Menu. Selalu pakai data menu
  // terbaru dari server bila menu-nya masih ada, supaya variasi tidak miss.
  const withFreshMenu = useCallback((rows: OrderRow[]): OrderRow[] => {
    if (menuItems.length === 0) return rows;
    return rows.map(r => {
      if (!r.menuItem) return r;
      const fresh = menuItems.find(m => m.id === r.menuItem!.id);
      if (!fresh || fresh === r.menuItem) return r;
      // Buang centang variasi yang sudah tidak ada / tidak ready di data terbaru.
      const validNames = new Set(
        getMenuVariants(fresh).filter(isVariantAvailable).map(v => v.name)
      );
      return {
        ...r,
        menuItem: fresh,
        variasi: r.variasi.filter(name => validNames.has(name)),
      };
    });
  }, [menuItems]);

  const resolvedOrderRows = useMemo(() => withFreshMenu(orderRows), [withFreshMenu, orderRows]);
  const resolvedMinumanRows = useMemo(() => withFreshMenu(minumanRows), [withFreshMenu, minumanRows]);

  // ---- Print ----
  const [printTarget, setPrintTarget] = useState<'makanan' | 'minuman'>('makanan');

  const handlePrint = (target: 'makanan' | 'minuman') => {
    setPrintTarget(target);
    setPreviewOpen(false);
    setTimeout(() => window.print(), 300);
  };

  // Yang dicetak: menu terisi & tidak ditandai habis oleh kasir.
  const filledMakanan = resolvedOrderRows.filter(r => r.menuItem !== null && !r.habis);
  const filledMinuman = resolvedMinumanRows.filter(r => r.menuItem !== null && !r.habis);

  // ---- Filtered menu for picker ----
  const pickerItems = (menuPickerTarget?.section === 'minuman' ? minumanMenuItems : makananItems)
    .filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase()));

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <MainLayout>
      <div className="nota-page p-8">

        {/* ============ PAGE HEADER ============ */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Nota Pesanan</h1>
            <p className="text-muted-foreground mt-1">Buat nota untuk pelanggan</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchMenuItems}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh Menu
            </Button>
            <Button
              size="sm"
              className="btn-primary"
              onClick={() => setPreviewOpen(true)}
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Preview & Print
            </Button>
          </div>
        </div>

        {/* ============ FORM CONTAINER ============ */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

          {/* Customer Info */}
          <div className="px-6 pt-5 pb-4 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Nama Pelanggan</label>
                <Input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nama pelanggan..."
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Hash className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Nomor Meja</label>
                <Input
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  placeholder="No. meja..."
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* ============ MAKANAN TABLE ============ */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                MAKANAN / SNACK
              </h2>
              <span className="text-xs text-muted-foreground">{filledMakanan.length} item</span>
            </div>

            <div className="rounded-xl overflow-hidden border border-border">
              {/* Table header */}
              <div className={`grid ${ROW_GRID} bg-muted text-xs font-bold text-muted-foreground uppercase tracking-wider`}>
                <div className="px-3 py-2.5 text-center">URUTAN</div>
                <div className="px-3 py-2.5">PESANAN</div>
                <div className="px-3 py-2.5">VARIASI</div>
                <div className="px-3 py-2.5">KETERANGAN</div>
                <div className="px-3 py-2.5 text-center">AKSI</div>
              </div>

              {/* Rows */}
              {resolvedOrderRows.map((row, idx) => (
                <OrderRowItem
                  key={row.id}
                  row={row}
                  index={idx}
                  total={resolvedOrderRows.length}
                  accent="amber"
                  pickerLabel="Pilih menu..."
                  onMove={dir => moveMakananRow(idx, dir)}
                  onOpenPicker={() => openMenuPicker(row.id, 'makanan')}
                  onToggleVariasi={name => toggleMakananVariasi(row.id, name)}
                  onToggleHabis={() => toggleMakananHabis(row.id)}
                  onChangeKeterangan={val => updateMakananRow(row.id, { keterangan: val })}
                  onRemove={() => removeMakananRow(row.id)}
                />
              ))}

              {/* Add row */}
              <div className="border-t border-border bg-muted/30">
                <button
                  onClick={addMakananRow}
                  className="w-full py-2.5 text-xs text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center justify-center gap-2 hover:bg-muted/60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah baris pesanan
                </button>
              </div>
            </div>
          </div>

          {/* ============ MINUMAN TABLE ============ */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                MINUMAN
              </h2>
              <span className="text-xs text-muted-foreground">{filledMinuman.length} item</span>
            </div>

            <div className="rounded-xl overflow-hidden border border-border">
              <div className={`grid ${ROW_GRID} bg-muted text-xs font-bold text-muted-foreground uppercase tracking-wider`}>
                <div className="px-3 py-2.5 text-center">URUTAN</div>
                <div className="px-3 py-2.5">PESANAN</div>
                <div className="px-3 py-2.5">VARIASI</div>
                <div className="px-3 py-2.5">KETERANGAN</div>
                <div className="px-3 py-2.5 text-center">AKSI</div>
              </div>

              {resolvedMinumanRows.map((row, idx) => (
                <OrderRowItem
                  key={row.id}
                  row={row}
                  index={idx}
                  total={resolvedMinumanRows.length}
                  accent="blue"
                  pickerLabel="Pilih minuman..."
                  onMove={dir => moveMinumanRow(idx, dir)}
                  onOpenPicker={() => openMenuPicker(row.id, 'minuman')}
                  onToggleVariasi={name => toggleMinumanVariasi(row.id, name)}
                  onToggleHabis={() => toggleMinumanHabis(row.id)}
                  onChangeKeterangan={val => updateMinumanRow(row.id, { keterangan: val })}
                  onRemove={() => removeMinumanRow(row.id)}
                />
              ))}

              <div className="border-t border-border bg-muted/30">
                <button
                  onClick={addMinumanRow}
                  className="w-full py-2.5 text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2 hover:bg-muted/60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah minuman
                </button>
              </div>
            </div>
          </div>

          {/* ============ FOOTER ============ */}
          <div className="px-6 pb-6 pt-4 border-t border-border flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              {filledMakanan.length + filledMinuman.length} item pesanan
            </div>
            <Button
              className="btn-primary px-6 h-12 text-base"
              onClick={() => setPreviewOpen(true)}
            >
              <Printer className="w-5 h-5 mr-2" />
              Print Nota
            </Button>
          </div>
        </div>
      </div>

      {/* ===================== MENU PICKER DIALOG ===================== */}
      <Dialog open={menuPickerOpen} onOpenChange={setMenuPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Pilih {menuPickerTarget?.section === 'minuman' ? 'Minuman' : 'Menu Makanan'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              placeholder="Cari menu..."
              autoFocus
            />
            {loadingMenu ? (
              <div className="text-center py-8 text-muted-foreground">Memuat menu...</div>
            ) : pickerItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Tidak ada menu tersedia</div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                {pickerItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => selectMenu(item)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted hover:bg-muted-foreground/10 text-left transition-colors border border-transparent hover:border-amber-500/30"
                  >
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-muted-foreground text-xs mt-0.5 capitalize flex items-center gap-1.5">
                        <span>{item.category}</span>
                        {item.stock != null && (
                          <span className={item.stock <= 0 ? 'text-destructive font-medium normal-case' : 'normal-case'}>
                            · Stok: {item.stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-amber-600 dark:text-amber-400 font-bold text-sm">{formatCurrency(item.price)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== PREVIEW DIALOG ===================== */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-slate-800">Preview Nota Pesanan</DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                  <X className="w-4 h-4 mr-1" /> Tutup
                </Button>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => handlePrint('makanan')}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print Nota Makanan
                </Button>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold" onClick={() => handlePrint('minuman')}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print Nota Minuman
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* 58mm Thermal Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nota Makanan / Snack</div>
              <div id="nota-preview-makanan" className="mx-auto bg-white p-3 text-black border border-slate-200 rounded-lg" style={{ width: '58mm' }}>
                <NotaPrint storeInfo={storeInfo} rows={filledMakanan} type="makanan" />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nota Minuman</div>
              <div id="nota-preview-minuman" className="mx-auto bg-white p-3 text-black border border-slate-200 rounded-lg" style={{ width: '58mm' }}>
                <NotaPrint storeInfo={storeInfo} rows={filledMinuman} type="minuman" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== PRINT STYLES (58mm Thermal, sama seperti nota transaksi) ===================== */}
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

          #nota-print-content,
          #nota-print-content * {
            visibility: visible;
            height: auto;
          }

          #nota-print-content {
            display: block !important;
            position: fixed;
            left: 0;
            top: 0;
            width: 58mm;
            padding: 0 6mm 5mm 6mm;
            margin: 0;
            z-index: 9999;
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: white;
            font-weight: 400;
          }

          #nota-print-content * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000 !important;
          }
        }
      `}</style>

      {/* Hidden print content */}
      <div id="nota-print-content" className="hidden">
        <NotaPrint
          storeInfo={storeInfo}
          rows={printTarget === 'makanan' ? filledMakanan : filledMinuman}
          type={printTarget}
        />
      </div>
    </MainLayout>
  );
}

// ====================== NOTA PRINT COMPONENT ======================
interface NotaPrintProps {
  storeInfo: { name: string; address: string };
  rows: OrderRow[];
  type: 'makanan' | 'minuman';
}

function NotaPrint({ storeInfo, rows, type }: NotaPrintProps) {
  const isMakanan = type === 'makanan';

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '11px', lineHeight: 1.3, background: 'white' }}>
      {/* ============ HEADER ============ */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.1 }}>
          {storeInfo.name}
        </div>
        <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
          Nota Pesanan {isMakanan ? 'Makanan / Snack' : 'Minuman'}
        </div>
      </div>

      {/* ============ INFO PELANGGAN (diisi pelanggan) ============ */}
      <div style={{ fontSize: '10px', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dashed #000' }}>
        <div style={{ display: 'flex', marginBottom: '2px' }}>
          <span style={{ width: '52px', flexShrink: 0 }}>Nama</span>
          <span style={{ width: '10px', flexShrink: 0 }}>:</span>
          <span style={{ flex: 1, borderBottom: '1px dotted #000', minHeight: '11px' }}>&nbsp;</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '52px', flexShrink: 0 }}>No. Meja</span>
          <span style={{ width: '10px', flexShrink: 0 }}>:</span>
          <span style={{ flex: 1, borderBottom: '1px dotted #000', minHeight: '11px' }}>&nbsp;</span>
        </div>
      </div>

      {/* ============ DAFTAR MENU READY ============ */}
      <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '4px', textAlign: 'center' }}>
        {isMakanan ? 'MENU READY' : 'MINUMAN READY'}
      </div>
      <div style={{ fontSize: '9px', fontStyle: 'italic', textAlign: 'center', marginBottom: '6px' }}>
        Silakan isi jumlah pesanan
      </div>

      {rows.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '9px', textAlign: 'left' }}>PESANAN</th>
              <th style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '9px', textAlign: 'left', width: '110px' }}>
                VARIASI / JML
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              // Hanya variasi yang dicentang kasir (dan masih ready) yang ikut tercetak.
              // Nama variasi bisa duplikat di data menu; ambil satu per nama, utamakan
              // yang ada tambahan harga supaya keterangan "+Rp" tetap tercetak.
              const printedVariants = Object.values(
                getMenuVariants(row.menuItem)
                  .filter(v => isVariantAvailable(v) && row.variasi.includes(v.name))
                  .reduce<Record<string, MenuVariant>>((acc, v) => {
                    const existing = acc[v.name];
                    if (!existing || (v.price ?? 0) > (existing.price ?? 0)) acc[v.name] = v;
                    return acc;
                  }, {})
              );
              return (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000', padding: '5px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold' }}>{row.menuItem?.name}</div>
                    <div style={{ fontSize: '9px', fontWeight: 'normal' }}>
                      {formatCurrency(row.menuItem?.price ?? 0)}
                    </div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9px', lineHeight: 1.7 }}>
                    {printedVariants.length > 0 ? printedVariants.map(v => (
                      <div key={v.name} style={{ marginBottom: '1px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '1px solid #000', flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{v.name}</span>
                          <span style={{ display: 'inline-block', width: '16px', borderBottom: '1px dotted #000', flexShrink: 0 }}>&nbsp;</span>
                        </div>
                        {(v.price ?? 0) > 0 && (
                          <div style={{ paddingLeft: '11px', fontSize: '8px', fontStyle: 'italic', lineHeight: 1.2 }}>
                            (+{formatCurrency(v.price)})
                          </div>
                        )}
                      </div>
                    )) : (
                      // Menu tanpa variasi: satu kotak jumlah polos.
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '1px solid #000', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>Jumlah</span>
                        <span style={{ display: 'inline-block', width: '16px', borderBottom: '1px dotted #000' }}>&nbsp;</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '10px', padding: '8px 0' }}>
          Belum ada menu {isMakanan ? 'makanan' : 'minuman'} yang dipilih
        </div>
      )}

      {/* ============ FOOTER ============ */}
      <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '5px', marginTop: '4px', fontSize: '10px', fontStyle: 'italic', fontWeight: 'bold' }}>
        Terima Kasih
      </div>
    </div>
  );
}
