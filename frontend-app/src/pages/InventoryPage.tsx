import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency, formatNumber } from '@/utils/calculations';
import {
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  AlertTriangle,
  Filter,
  HelpCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from 'sonner';

interface InventoryItem {
  id: number;
  name: string;
  type: 'stock' | 'equipment';
  current_stock?: number;
  unit?: string;
  price_per_unit?: number;
  min_stock?: number;
  total_price?: number;
  category: string;
  value?: number;
  stock_status?: string;
  is_low_stock?: boolean;
  store_id?: number;
  status?: string;        // For equipment: Baik, Rusak, Maintenance
  description?: string;   // Keterangan
  quantity?: number;      // Jumlah unit alat
}

interface Store {
  id: number;
  name: string;
}

// Kategori untuk Bahan (Stock)
const stockCategories = ['Kopi', 'Susu', 'Pemanis', 'Topping', 'Es', 'Teh', 'Sirup', 'Bumbu', 'Bahan Makanan', 'Lainnya'];

// Kategori untuk Alat (Equipment)
const equipmentCategories = ['Alat Kopi', 'Alat Pendingin', 'Alat Makan', 'Alat Masak', 'Alat Kebersihan', 'Furniture', 'Elektronik', 'Lainnya'];

const units = ['gram', 'ml', 'pcs', 'kg', 'liter', 'dus', '-'];

export default function InventoryPage() {
  const { user, hasPermission, loading: authLoading, isAdmin } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'stock' | 'equipment'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'stock' | 'equipment_all' | 'Baik' | 'Rusak' | 'Hilang' | 'Maintenance' | 'Tidak Digunakan'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceInputMode, setPriceInputMode] = useState<'total' | 'unit'>('total');

  // Store management for admin
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    type: 'stock' as 'stock' | 'equipment',
    category: 'Kopi',
    // Stock fields
    current_stock: '',
    unit: 'gram',
    price_per_unit: '',
    min_stock: '',
    // Equipment fields
    total_price: '',
    status: '',
    description: '',
    quantity: '1',
    store_id: '',
  });

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin()) {
        fetchStores();
      } else {
        fetchItems();
      }
    }
  }, [typeFilter, authLoading, user?.id]);

  useEffect(() => {
    if (isAdmin() && stores.length > 0) {
      fetchItems();
    }
  }, [selectedStoreId, typeFilter]);

  const fetchStores = async () => {
    try {
      const response = await api.get('/stores-management');
      const storesData = response.data.data || [];
      setStores(storesData);
      // Optional: select first store
      // if (storesData.length > 0) setSelectedStoreId(storesData[0].id.toString());
      fetchItems();
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const params: any = typeFilter !== 'all' ? { type: typeFilter } : {};

      if (isAdmin() && selectedStoreId && selectedStoreId !== 'all') {
        params.store_id = selectedStoreId;
      }

      const response = await api.get('/inventory', { params });
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Gagal memuat data inventori');
    } finally {
      setLoading(false);
    }
  };

  // Counts based on ALL items (unfiltered by active filter, only by search)
  const searchedItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply activeFilter on top of search
  const filteredItems = searchedItems.filter((item) => {
    // Type / status filter
    const passType = (() => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'stock') return item.type === 'stock';
      if (activeFilter === 'equipment_all') return item.type === 'equipment';
      return item.type === 'equipment' && item.status === activeFilter;
    })();

    // Category filter
    const passCategory = categoryFilter === 'all' || item.category === categoryFilter;

    return passType && passCategory;
  });

  // Visible categories based on active type filter (for pills UI)
  const visibleCategories: string[] = (() => {
    const typeScope = activeFilter === 'stock'
      ? 'stock'
      : (activeFilter === 'all' ? 'all' : 'equipment');

    const cats = items
      .filter(item => typeScope === 'all' || item.type === typeScope)
      .map(item => item.category);
    return ['all', ...Array.from(new Set(cats)).sort()];
  })();

  const handleFilterClick = (filter: typeof activeFilter) => {
    setCategoryFilter('all'); // reset kategori saat ganti tipe filter
    setActiveFilter(prev => prev === filter ? 'all' : filter);
  };

  // Summary counts from searchedItems (so counters don't change when filtering)
  const totalItems = searchedItems.length;
  const totalBaik = searchedItems.filter((item) => item.type === 'equipment' && item.status === 'Baik').length;
  const totalRusak = searchedItems.filter((item) => item.type === 'equipment' && item.status === 'Rusak').length;
  const totalHilang = searchedItems.filter((item) => item.type === 'equipment' && item.status === 'Hilang').length;
  const totalStock = searchedItems.filter((item) => item.type === 'stock').length;
  const totalEquipment = searchedItems.filter((item) => item.type === 'equipment').length;

  const handleSubmit = async () => {
    try {
      // Basic validation
      if (!formData.name) {
        toast.error('Nama item harus diisi');
        return;
      }

      if (formData.type === 'stock') {
        if (!formData.current_stock || isNaN(parseFloat(formData.current_stock))) {
          toast.error('Stock awal harus diisi dengan angka');
          return;
        }
        if (!formData.total_price || isNaN(parseFloat(formData.total_price))) {
          toast.error('Harga total harus diisi dengan angka');
          return;
        }
      } else {
        if (!formData.total_price || isNaN(parseFloat(formData.total_price))) {
          toast.error('Harga alat harus diisi dengan angka');
          return;
        }
      }

      const payload: any = {
        name: formData.name,
        type: formData.type,
        category: formData.category,
        total_price: parseFloat(formData.total_price),
      };

      // Handle store_id based on user role
      if (isAdmin()) {
        if (!formData.store_id) {
          toast.error('Pilih toko terlebih dahulu');
          return;
        }
        payload.store_id = formData.store_id;
      } else {
        if (user?.store_id) {
          payload.store_id = user.store_id;
        }
      }

      if (formData.type === 'stock') {
        payload.current_stock = parseFloat(formData.current_stock);
        payload.unit = formData.unit;
        payload.min_stock = formData.min_stock ? parseFloat(formData.min_stock) : 0;
        // price_per_unit will be calculated automatically by backend
      } else {
        if (formData.status) payload.status = formData.status;
        if (formData.description) payload.description = formData.description;
        if (formData.quantity) payload.quantity = parseInt(formData.quantity);
      }

      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        toast.success('Item berhasil diupdate');
      } else {
        await api.post('/inventory', payload);
        toast.success('Item berhasil ditambahkan');
      }

      resetForm();
      fetchItems();
    } catch (error: any) {
      console.error('Failed to save item:', error);
      toast.error(error.response?.data?.message || 'Gagal menyimpan item');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      type: item.type,
      category: item.category,
      current_stock: item.current_stock?.toString() || '',
      unit: item.unit || 'gram',
      price_per_unit: item.price_per_unit?.toString() || '',
      min_stock: item.min_stock?.toString() || '',
      total_price: item.total_price?.toString() || '',
      status: item.status || '',
      description: item.description || '',
      quantity: item.quantity?.toString() || '1',
      store_id: item.store_id?.toString() || selectedStoreId || ''
    });
    setEditingItem(item);
    setIsAddDialogOpen(true);
    setPriceInputMode('total');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus item ini?')) return;

    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Item berhasil dihapus');
      fetchItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Gagal menghapus item');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'stock',
      category: 'Kopi',
      current_stock: '',
      unit: 'gram',
      price_per_unit: '',
      min_stock: '',
      total_price: '',
      status: '',
      description: '',
      quantity: '1',
      store_id: isAdmin() ? selectedStoreId : '',
    });
    setEditingItem(null);
    setIsAddDialogOpen(false);
    setPriceInputMode('total');
  };

  // State handlers to ensure consistent updates
  const handleStockChange = (stock: string) => {
    const newState = { ...formData, current_stock: stock };
    const stockVal = parseFloat(stock);

    if (stock && stockVal > 0) {
      if (priceInputMode === 'total' && formData.total_price) {
        // Calculate price per unit
        const pricePerUnit = parseFloat(formData.total_price) / stockVal;
        newState.price_per_unit = pricePerUnit.toFixed(2);
      } else if (priceInputMode === 'unit' && formData.price_per_unit) {
        // Calculate total price
        const totalPrice = parseFloat(formData.price_per_unit) * stockVal;
        newState.total_price = Math.round(totalPrice).toString();
      }
    }

    setFormData(newState);
  };

  // Calculate price per unit when total price changes (for stock)
  const handleTotalPriceChange = (totalPrice: string) => {
    const newState = { ...formData, total_price: totalPrice };

    if (formData.current_stock && parseFloat(formData.current_stock) > 0 && totalPrice) {
      const pricePerUnit = parseFloat(totalPrice) / parseFloat(formData.current_stock);
      newState.price_per_unit = pricePerUnit.toFixed(2);
    }

    setFormData(newState);
  };

  const handleUnitPriceChange = (unitPrice: string) => {
    const newState = { ...formData, price_per_unit: unitPrice };

    if (formData.current_stock && parseFloat(formData.current_stock) > 0 && unitPrice) {
      const totalPrice = parseFloat(unitPrice) * parseFloat(formData.current_stock);
      newState.total_price = Math.round(totalPrice).toString();
    }

    setFormData(newState);
  };

  const getStockStatusBadge = (status?: string) => {
    if (!status) return null;

    const badges = {
      critical: 'badge-destructive',
      warning: 'badge-warning',
      good: 'badge-success',
    };

    const labels = {
      critical: 'Habis',
      warning: 'Rendah',
      good: 'Baik',
    };

    return (
      <span className={badges[status as keyof typeof badges]}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading && items.length === 0) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p>Loading...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Inventori</h1>
            <p className="text-muted-foreground mt-1">
              Kelola stock bahan dan peralatan
            </p>
          </div>

          <div className="flex gap-4">
            {/* Store Filter for Admin */}
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

            {hasPermission('manage_inventory') && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="btn-primary"
                    onClick={() => {
                      resetForm();
                      if (isAdmin() && selectedStoreId && selectedStoreId !== 'all') {
                        setFormData(prev => ({ ...prev, store_id: selectedStoreId }));
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display">
                      {editingItem ? 'Edit Item' : 'Tambah Item Baru'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
                    {isAdmin() && (
                      <div>
                        <Label>Pilih Toko</Label>
                        <Select
                          value={formData.store_id}
                          onValueChange={(v) => setFormData({ ...formData, store_id: v })}
                        >
                          <SelectTrigger className="input-coffee mt-1">
                            <SelectValue placeholder="Pilih Toko" />
                          </SelectTrigger>
                          <SelectContent>
                            {stores.map((store) => (
                              <SelectItem key={store.id} value={store.id.toString()}>
                                {store.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Nama Item</Label>
                      <Input
                        className="input-coffee mt-1"
                        placeholder="Contoh: Kopi Arabica"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tipe</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(v: 'stock' | 'equipment') => {
                            // Update type and set default category based on type
                            const defaultCategory = v === 'stock' ? stockCategories[0] : equipmentCategories[0];
                            setFormData({ ...formData, type: v, category: defaultCategory });
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stock">Stock (Bahan)</SelectItem>
                            <SelectItem value="equipment">Equipment (Alat)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Kategori</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(v) => setFormData({ ...formData, category: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(formData.type === 'stock' ? stockCategories : equipmentCategories).map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formData.type === 'stock' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Stock Awal</Label>
                            <Input
                              className="input-coffee mt-1"
                              type="number"
                              placeholder="1000"
                              value={formData.current_stock}
                              onChange={(e) => handleStockChange(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Satuan</Label>
                            <Select
                              value={formData.unit}
                              onValueChange={(v) => setFormData({ ...formData, unit: v })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {units.map((unit) => (
                                  <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <Label className="mb-2 block">Mode Input Harga</Label>
                          <RadioGroup
                            defaultValue="total"
                            value={priceInputMode}
                            onValueChange={(v) => {
                              setPriceInputMode(v as 'total' | 'unit');
                              // Recalculate based on new mode if needed?
                              // Actually, keeping values as is is fine, user will edit the active field.
                            }}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="total" id="mode-total" />
                              <Label htmlFor="mode-total" className="font-normal cursor-pointer">Harga Total</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="unit" id="mode-unit" />
                              <Label htmlFor="mode-unit" className="font-normal cursor-pointer">Harga Per Satuan</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Harga Total (Rp)</Label>
                            <Input
                              className={`input-coffee mt-1 ${priceInputMode === 'unit' ? 'bg-muted opacity-70' : ''}`}
                              type="number"
                              placeholder="100000"
                              value={formData.total_price}
                              onChange={(e) => handleTotalPriceChange(e.target.value)}
                              readOnly={priceInputMode === 'unit'}
                            />
                          </div>
                          <div>
                            <Label>Harga Per {formData.unit || 'Unit'} (Rp)</Label>
                            <Input
                              className={`input-coffee mt-1 ${priceInputMode === 'total' ? 'bg-muted opacity-70' : ''}`}
                              type="number"
                              placeholder="1000"
                              value={formData.price_per_unit}
                              onChange={(e) => handleUnitPriceChange(e.target.value)}
                              readOnly={priceInputMode === 'total'}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Stock Minimum</Label>
                          <Input
                            className="input-coffee mt-1"
                            type="number"
                            placeholder="100"
                            value={formData.min_stock}
                            onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Harga Alat (Rp)</Label>
                            <Input
                              className="input-coffee mt-1"
                              type="number"
                              placeholder="5000000"
                              value={formData.total_price}
                              onChange={(e) => setFormData({ ...formData, total_price: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Jumlah (Unit)</Label>
                            <Input
                              className="input-coffee mt-1"
                              type="number"
                              min="1"
                              placeholder="1"
                              value={formData.quantity}
                              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Status</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(v) => setFormData({ ...formData, status: v })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Pilih Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Baik">Baik</SelectItem>
                              <SelectItem value="Rusak">Rusak</SelectItem>
                              <SelectItem value="Hilang">Hilang</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Tidak Digunakan">Tidak Digunakan</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Keterangan</Label>
                          <Input
                            className="input-coffee mt-1"
                            placeholder="Catatan tambahan tentang alat..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button variant="outline" className="flex-1" onClick={resetForm}>
                        Batal
                      </Button>
                      <button className="btn-primary flex-1" onClick={handleSubmit}>
                        {editingItem ? 'Simpan' : 'Tambah'}
                      </button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Search Bar + Category Filter */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              className="input-coffee pl-12"
              placeholder="Cari item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Dropdown Kategori — tampil hanya saat filter stock atau alat */}
          {activeFilter !== 'all' && (
            <div className="w-[200px]">
              <Select
                value={categoryFilter}
                onValueChange={(val) => setCategoryFilter(val)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {(
                    activeFilter === 'stock'
                      ? stockCategories
                      : equipmentCategories
                  ).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                      <span className="ml-1 text-muted-foreground text-xs">
                        ({searchedItems.filter(i =>
                          i.category === cat &&
                          (activeFilter === 'stock' ? i.type === 'stock' : i.type === 'equipment')
                        ).length})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reset Filter */}
          {(activeFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={() => { setActiveFilter('all'); setCategoryFilter('all'); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-secondary transition-all whitespace-nowrap"
            >
              <Filter className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        {/* Summary Stats — sebagai Filter Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">

          {/* Total Semua */}
          <button
            onClick={() => handleFilterClick('all')}
            className={`card-elevated p-4 flex items-center gap-3 text-left transition-all duration-200 hover:scale-[1.02] ${activeFilter === 'all'
              ? 'ring-2 ring-primary shadow-lg'
              : 'opacity-80 hover:opacity-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
              }`}>
              <Package className={`w-5 h-5 ${activeFilter === 'all' ? 'text-primary-foreground' : 'text-primary'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Semua Item</p>
              <p className="text-xl font-bold">{totalItems}</p>
            </div>
          </button>

          {/* Stock Bahan */}
          <button
            onClick={() => handleFilterClick('stock')}
            className={`card-elevated p-4 flex items-center gap-3 text-left transition-all duration-200 hover:scale-[1.02] ${activeFilter === 'stock'
              ? 'ring-2 ring-blue-500 shadow-lg'
              : 'opacity-80 hover:opacity-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeFilter === 'stock' ? 'bg-blue-500 text-white' : 'bg-blue-500/10'
              }`}>
              <Package className={`w-5 h-5 ${activeFilter === 'stock' ? 'text-white' : 'text-blue-500'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock (Bahan)</p>
              <p className="text-xl font-bold">{totalStock}</p>
            </div>
          </button>

          {/* Alat Baik */}
          <button
            onClick={() => handleFilterClick('Baik')}
            className={`card-elevated p-4 flex items-center gap-3 text-left transition-all duration-200 hover:scale-[1.02] ${activeFilter === 'Baik'
              ? 'ring-2 ring-success shadow-lg'
              : 'opacity-80 hover:opacity-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeFilter === 'Baik' ? 'bg-success text-white' : 'bg-success/10'
              }`}>
              <Filter className={`w-5 h-5 ${activeFilter === 'Baik' ? 'text-white' : 'text-success'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alat Baik</p>
              <p className={`text-xl font-bold ${activeFilter === 'Baik' ? 'text-success' : 'text-success'}`}>{totalBaik}</p>
              <p className="text-xs text-muted-foreground">dari {totalEquipment} alat</p>
            </div>
          </button>

          {/* Alat Rusak */}
          <button
            onClick={() => handleFilterClick('Rusak')}
            className={`card-elevated p-4 flex items-center gap-3 text-left transition-all duration-200 hover:scale-[1.02] ${activeFilter === 'Rusak'
              ? 'ring-2 ring-destructive shadow-lg'
              : 'opacity-80 hover:opacity-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeFilter === 'Rusak' ? 'bg-destructive text-white' : 'bg-destructive/10'
              }`}>
              <AlertTriangle className={`w-5 h-5 ${activeFilter === 'Rusak' ? 'text-white' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alat Rusak</p>
              <p className={`text-xl font-bold text-destructive`}>{totalRusak}</p>
              <p className="text-xs text-muted-foreground">dari {totalEquipment} alat</p>
            </div>
          </button>

          {/* Alat Hilang */}
          <button
            onClick={() => handleFilterClick('Hilang')}
            className={`card-elevated p-4 flex items-center gap-3 text-left transition-all duration-200 hover:scale-[1.02] ${activeFilter === 'Hilang'
              ? 'ring-2 ring-purple-500 shadow-lg'
              : 'opacity-80 hover:opacity-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeFilter === 'Hilang' ? 'bg-purple-500 text-white' : 'bg-purple-500/10'
              }`}>
              <HelpCircle className={`w-5 h-5 ${activeFilter === 'Hilang' ? 'text-white' : 'text-purple-500'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alat Hilang</p>
              <p className="text-xl font-bold text-purple-500">{totalHilang}</p>
              <p className="text-xs text-muted-foreground">dari {totalEquipment} alat</p>
            </div>
          </button>

        </div>

        {/* Active Filter Label */}
        {(activeFilter !== 'all' || categoryFilter !== 'all') && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm text-muted-foreground">Menampilkan:</span>
            {activeFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${activeFilter === 'stock' ? 'bg-blue-500/10 text-blue-500' :
                activeFilter === 'Baik' ? 'bg-success/10 text-success' :
                  activeFilter === 'Rusak' ? 'bg-destructive/10 text-destructive' :
                    activeFilter === 'Hilang' ? 'bg-purple-500/10 text-purple-500' :
                      'bg-secondary text-secondary-foreground'
                }`}>
                {activeFilter === 'stock' ? '📦 Stock (Bahan)' :
                  activeFilter === 'Baik' ? '✅ Alat Baik' :
                    activeFilter === 'Rusak' ? '⚠️ Alat Rusak' :
                      activeFilter === 'Hilang' ? '❓ Alat Hilang' : activeFilter}
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                🏷️ {categoryFilter}
              </span>
            )}
            <span className="text-sm font-medium text-muted-foreground">{filteredItems.length} item</span>
          </div>
        )}


        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="card-elevated p-5 animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                {hasPermission('manage_inventory') && (
                  <div className="flex gap-1">
                    <button
                      className="p-2 rounded-lg hover:bg-secondary"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-destructive/10"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="font-display font-semibold text-lg">{item.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{item.category}</p>

              <div className="space-y-2 pt-3 border-t border-border">
                {item.type === 'stock' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stock</span>
                      <span className="font-medium">
                        {formatNumber(item.current_stock || 0)} {item.unit}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Harga/{item.unit}</span>
                      <span className="font-medium">{formatCurrency(item.price_per_unit || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Harga</span>
                      <span className="font-medium text-success">{formatCurrency(item.total_price || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Status</span>
                      {getStockStatusBadge(item.stock_status)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Harga</span>
                      <span className="font-bold text-lg">{formatCurrency(item.total_price || 0)}</span>
                    </div>
                    {item.quantity !== undefined && item.quantity !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Jumlah</span>
                        <span className="font-medium">{item.quantity} unit</span>
                      </div>
                    )}
                    {item.status && (
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Baik' ? 'bg-success/10 text-success' :
                          item.status === 'Rusak' ? 'bg-destructive/10 text-destructive' :
                            item.status === 'Hilang' ? 'bg-purple-500/10 text-purple-500' :
                              item.status === 'Maintenance' ? 'bg-warning/10 text-warning' :
                                'bg-secondary text-secondary-foreground'
                          }`}>
                          {item.status}
                        </span>
                      </div>
                    )}
                    {item.description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Keterangan:</span>
                        <p className="text-foreground mt-1 text-xs">{item.description}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {item.is_low_stock && (
                <div className="mt-3 p-2 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="text-xs text-warning font-medium">Stock Rendah!</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Tidak ada item ditemukan</p>
            {isAdmin() && !selectedStoreId && (
              <p className="text-sm text-muted-foreground mt-1">Simpan filter Toko ke 'Semua' atau pilih toko spesifik</p>
            )}
          </div>
        )}
      </div>
    </MainLayout >
  );
}
