import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency } from '@/utils/calculations';
import {
  Plus,
  Search,
  Coffee,
  Edit2,
  Trash2,
  Filter,
  Utensils,
  GlassWater,
  Cookie,
  ChevronUp,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  current_stock?: number;
}

interface Ingredient {
  inventory_item_id: number;
  amount: number;
  inventory_item?: InventoryItem;
}

interface MenuItem {
  current_stock?: number;
  id: number;
  name: string;
  category: string;
  store_id?: string;
  price: number;
  discount_percentage?: number;
  uses_ingredients?: boolean;
  status?: 'ready' | 'kosong' | 'pending';
  stock?: number;
  image?: string;
  cogs?: number;
  profit?: number;
  margin?: number;
  menu_ingredients?: Array<{
    inventory_item?: InventoryItem;
    amount: number;
  }>;
  variants?: Array<{
    name: string;
    price: number;
    status: 'ready' | 'kosong' | 'pending';
  }>;
  parent_id?: number | null;
  portion_value?: number;
}

interface Store {
  id: number;
  name: string;
}

const categories = ['Kopi', 'Non-Kopi', 'Teh', 'Makanan', 'Snack', 'Minuman'];

export default function MenuPage() {
  const { user, isAdmin, hasPermission, canEdit } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);

  const getCategoryIcon = (category: string) => {
    const className = "w-6 h-6 text-primary";
    const lowerCat = category?.toLowerCase() || '';
    if (lowerCat === 'makanan') return <Utensils className={className} />;
    if (lowerCat === 'snack') return <Cookie className={className} />;
    if (['minuman', 'non-kopi', 'teh'].includes(lowerCat)) return <GlassWater className={className} />;
    return <Coffee className={className} />;
  };

  const [formData, setFormData] = useState({
    name: '',
    category: 'Kopi',
    price: '',
    discount_percentage: '0',
    uses_ingredients: true,
    status: 'ready' as 'ready' | 'kosong' | 'pending',
    stock: '0',
    store_id: '',
    parent_id: null as string | null,
    portion_value: '1',
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngredient, setNewIngredient] = useState({ inventory_item_id: 0, amount: '' });
  const [menuVariants, setMenuVariants] = useState<Array<{ name: string; price: number; status: 'ready' | 'kosong' | 'pending' }>>([]);
  const [newVariant, setNewVariant] = useState({ name: '', price: '', status: 'ready' as 'ready' | 'kosong' | 'pending' });

  useEffect(() => {
    if (isAdmin()) {
      fetchStores();
    } else {
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (isAdmin() && stores.length > 0) {
      fetchData();
    }
  }, [selectedStoreId]);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      const response = await api.get('/stores-management');
      const storesData = response.data.data || [];
      setStores(storesData);
      if (storesData.length > 0) {
        // Optional: select first store by default or keep empty for all
        // setSelectedStoreId(storesData[0].id.toString());
      }
      fetchData(); // Fetch initial data (all stores or none)
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = {};
      if (isAdmin() && selectedStoreId && selectedStoreId !== 'all') {
        params.store_id = selectedStoreId;
      }

      const [menuRes, inventoryRes] = await Promise.all([
        api.get('/menu', { params }),
        api.get('/inventory', { params: { ...params, type: 'stock' } }),
      ]);
      setMenuItems(menuRes.data);
      setInventoryItems(inventoryRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategoryFilter || item.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAddIngredient = () => {
    if (newIngredient.inventory_item_id && newIngredient.amount) {
      setIngredients([...ingredients, {
        inventory_item_id: newIngredient.inventory_item_id,
        amount: parseFloat(newIngredient.amount)
      }]);
      setNewIngredient({ inventory_item_id: 0, amount: '' });
    }
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      const payload: any = {
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        discount_percentage: parseFloat(formData.discount_percentage) || 0,
        uses_ingredients: formData.uses_ingredients,
        status: formData.status,
        stock: parseInt(formData.stock) || 0,
        variants: menuVariants,
        parent_id: formData.parent_id && formData.parent_id !== 'pending_select' ? parseInt(formData.parent_id) : null,
        portion_value: parseFloat(formData.portion_value) || 1,
      };

      // Validate ingredients if uses_ingredients is true
      if (formData.uses_ingredients) {
        if (ingredients.length === 0) {
          if (newIngredient.inventory_item_id && newIngredient.amount) {
            toast.error("Silakan klik tombol (+) untuk menambahkan bahan baku ke daftar");
            return;
          }
          toast.error("Harap tambahkan minimal satu bahan baku");
          return;
        }
        payload.ingredients = ingredients;
      }

      if (isAdmin()) {
        if (!formData.store_id) {
          toast.error('Pilih toko terlebih dahulu');
          return;
        }
        payload.store_id = formData.store_id;
      }

      if (editingItem) {
        await api.put(`/menu/${editingItem.id}`, payload);
        toast.success('Menu berhasil diupdate');
      } else {
        await api.post('/menu', payload);
        toast.success('Menu berhasil ditambahkan');
      }

      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to save menu:', error);
      toast.error(error.response?.data?.message || 'Gagal menyimpan menu');
    }
  };

  const handleEdit = (item: MenuItem) => {
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      discount_percentage: (item.discount_percentage || 0).toString(),
      uses_ingredients: item.uses_ingredients ?? true,
      status: item.status || 'ready',
      stock: (item.stock || 0).toString(),
      store_id: item.store_id ? item.store_id.toString() : selectedStoreId,
      parent_id: item.parent_id ? item.parent_id.toString() : null,
      portion_value: (item.portion_value || 1).toString(),
    });

    const formattedIngredients = item.menu_ingredients
      ?.filter(ing => ing.inventory_item && ing.inventory_item.id)
      .map(ing => ({
        inventory_item_id: ing.inventory_item!.id,
        amount: ing.amount,
      })) || [];

    setIngredients(formattedIngredients);
    setMenuVariants(item.variants || []);
    setEditingItem(item);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus menu ini?')) return;

    try {
      await api.delete(`/menu/${id}`);
      toast.success('Menu berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Failed to delete menu:', error);
      toast.error('Gagal menghapus menu');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Kopi',
      price: '',
      discount_percentage: '0',
      uses_ingredients: true,
      status: 'ready',
      stock: '0',
      store_id: isAdmin() ? selectedStoreId : '',
      parent_id: null,
      portion_value: '1'
    });
    setIngredients([]);
    setNewIngredient({ inventory_item_id: 0, amount: '' });
    setMenuVariants([]);
    setNewVariant({ name: '', price: '', status: 'ready' });
    setEditingItem(null);
    setIsAddDialogOpen(false);
  };

  if (loading && menuItems.length === 0) {
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
            <h1 className="text-3xl font-display font-bold">Menu & Resep</h1>
            <p className="text-muted-foreground mt-1">
              Kelola menu dan tentukan bahan per minuman untuk menghitung HPP
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

            {hasPermission('manage_menu') && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="btn-primary"
                    onClick={() => {
                      resetForm();
                      // Pre-select store in form if filtered
                      if (isAdmin() && selectedStoreId && selectedStoreId !== 'all') {
                        setFormData(prev => ({ ...prev, store_id: selectedStoreId }));
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Menu
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="font-display">
                      {editingItem ? 'Edit Menu' : 'Tambah Menu Baru'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
                    {isAdmin() && !editingItem && (
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
                      <Label>Nama Menu</Label>
                      <Input
                        className="input-coffee mt-1"
                        placeholder="Contoh: Es Kopi Susu"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Kategori</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(v) => setFormData({ ...formData, category: v })}
                        >
                          <SelectTrigger className="input-coffee mt-1">
                            <SelectValue placeholder="Pilih kategori" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Harga Jual</Label>
                        <Input
                          className="input-coffee mt-1"
                          type="number"
                          placeholder="0"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Discount (%)</Label>
                      <Input
                        className="input-coffee mt-1"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={formData.discount_percentage}
                        onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Harga setelah discount: {formData.price && formData.discount_percentage ?
                          formatCurrency(parseFloat(formData.price) * (1 - parseFloat(formData.discount_percentage) / 100)) :
                          formatCurrency(parseFloat(formData.price) || 0)}
                      </p>
                    </div>

                    {/* Uses Ingredients Toggle */}
                    <div className="flex items-center space-x-2 p-4 bg-secondary/20 rounded-lg">
                      <Checkbox
                        id="uses_ingredients"
                        checked={formData.uses_ingredients}
                        onCheckedChange={(checked) => setFormData({ ...formData, uses_ingredients: checked as boolean })}
                      />
                      <div className="flex-1">
                        <Label htmlFor="uses_ingredients" className="cursor-pointer font-medium">
                          Menggunakan Bahan Baku
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Centang jika menu ini memerlukan bahan dari inventory untuk menghitung HPP
                        </p>
                      </div>
                    </div>

                    {/* Status & Stock Logic - Modified: Hidden if uses_ingredients */}
                    {!formData.uses_ingredients ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Status Menu</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(v) => setFormData({ ...formData, status: v as 'ready' | 'kosong' | 'pending' })}
                          >
                            <SelectTrigger className="input-coffee mt-1">
                              <SelectValue placeholder="Pilih status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ready">Ready - Siap dipesan</SelectItem>
                              <SelectItem value="kosong">Kosong - Tidak tersedia</SelectItem>
                              <SelectItem value="pending">Pending - Perlu waktu tunggu</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2 space-y-3 border p-4 rounded-lg bg-secondary/10">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="use_shared_stock"
                              checked={formData.parent_id !== null}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({ ...formData, parent_id: 'pending_select', stock: '0' });
                                } else {
                                  setFormData({ ...formData, parent_id: null, portion_value: '1' });
                                }
                              }}
                            />
                            <Label htmlFor="use_shared_stock" className="cursor-pointer">Gunakan Stock dari Menu Lain (Shared Stock)</Label>
                          </div>

                          {formData.parent_id !== null ? (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                              <div>
                                <Label>Pilih Menu Induk</Label>
                                <Select
                                  value={formData.parent_id === 'pending_select' ? '' : formData.parent_id || ''}
                                  onValueChange={(val) => setFormData({ ...formData, parent_id: val })}
                                >
                                  <SelectTrigger className="input-coffee mt-1">
                                    <SelectValue placeholder="Pilih Menu" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {menuItems
                                      .filter(i => i.id !== editingItem?.id && !i.parent_id && (!formData.store_id || i.store_id?.toString() == formData.store_id))
                                      .map(i => (
                                        <SelectItem key={i.id} value={i.id.toString()}>{i.name} (Stock: {i.stock})</SelectItem>
                                      ))
                                    }
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Nilai Porsi (Portion)</Label>
                                <Input
                                  className="input-coffee mt-1"
                                  type="number"
                                  step="0.1"
                                  value={formData.portion_value}
                                  onChange={(e) => setFormData({ ...formData, portion_value: e.target.value })}
                                  placeholder="1.0"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Contoh: 0.5 untuk 1/2 porsi</p>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Label>Stock / Porsi Harian</Label>
                              <Input
                                className="input-coffee mt-1"
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">
                            Stock akan berkurang saat dipesan. Untuk menu dengan resep, stock ini berfungsi sebagai batas porsi harian.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-secondary/30 rounded-lg text-sm flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Dikontrol Inventory</p>
                          <p className="text-muted-foreground">Stock dan Status menu ini akan otomatis mengikuti ketersediaan bahan baku di inventory.</p>
                        </div>
                      </div>
                    )}

                    {/* Ingredients Section - Only show if uses_ingredients is true */}
                    {formData.uses_ingredients && (
                      <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <Label>Resep & Bahan</Label>
                        </div>

                        {ingredients.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {ingredients.map((ing, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                                <span className="flex-1 font-medium">
                                  {inventoryItems.find(i => i.id === ing.inventory_item_id)?.name || 'Unknown'}
                                </span>
                                <span className="text-muted-foreground">
                                  {ing.amount} {inventoryItems.find(i => i.id === ing.inventory_item_id)?.unit || ''}
                                </span>
                                <button
                                  className="p-1 hover:bg-destructive/10 rounded"
                                  onClick={() => handleRemoveIngredient(idx)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Select
                            value={newIngredient.inventory_item_id.toString()}
                            onValueChange={(v) => setNewIngredient({ ...newIngredient, inventory_item_id: Number(v) })}
                          >
                            <SelectTrigger className="flex-1 input-coffee">
                              <SelectValue placeholder="Pilih bahan baku" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventoryItems.map((item) => (
                                <SelectItem key={item.id} value={item.id.toString()}>
                                  {item.name} ({item.current_stock} {item.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="w-24 input-coffee"
                            type="number"
                            placeholder="Jumlah"
                            value={newIngredient.amount}
                            onChange={(e) => setNewIngredient({ ...newIngredient, amount: e.target.value })}
                          />
                          <Button variant="outline" onClick={handleAddIngredient}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Variants Section */}
                    <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Variasi Menu (Opsional)</Label>
                      </div>

                      {menuVariants.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {menuVariants.map((variant, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-3 bg-secondary rounded-lg group">
                              <div className="flex flex-col gap-0.5 mr-1">
                                <button
                                  className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded disabled:opacity-30"
                                  disabled={idx === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (idx === 0) return;
                                    const updated = [...menuVariants];
                                    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                                    setMenuVariants(updated);
                                  }}
                                  title="Geser ke atas"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded disabled:opacity-30"
                                  disabled={idx === menuVariants.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (idx === menuVariants.length - 1) return;
                                    const updated = [...menuVariants];
                                    [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
                                    setMenuVariants(updated);
                                  }}
                                  title="Geser ke bawah"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>

                              <span className="flex-1 font-medium text-sm">
                                {variant.name} ({variant.price > 0 ? `+${formatCurrency(variant.price)}` : 'Free'})
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 select-none ${variant.status === 'ready' ? 'bg-green-100 text-green-700' :
                                  variant.status === 'kosong' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                onClick={() => {
                                  const nextStatus = variant.status === 'ready' ? 'pending' : variant.status === 'pending' ? 'kosong' : 'ready';
                                  const updated = [...menuVariants];
                                  updated[idx].status = nextStatus;
                                  setMenuVariants(updated);
                                }}
                                title="Klik untuk ubah status"
                              >
                                {variant.status}
                              </span>
                              <button
                                className="p-1 hover:bg-destructive/10 rounded"
                                onClick={() => setMenuVariants(menuVariants.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Input
                            className="flex-1 input-coffee"
                            placeholder="Nama Variasi (misal: Kuah Coto)"
                            value={newVariant.name}
                            onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                          />
                          <Input
                            className="w-28 input-coffee"
                            type="number"
                            placeholder="Harga +"
                            value={newVariant.price}
                            onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={newVariant.status}
                            onValueChange={(v) => setNewVariant({ ...newVariant, status: v as any })}
                          >
                            <SelectTrigger className="w-[120px] input-coffee">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ready">Ready</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="kosong">Kosong</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              if (newVariant.name) {
                                setMenuVariants([...menuVariants, {
                                  name: newVariant.name,
                                  price: parseFloat(newVariant.price) || 0,
                                  status: newVariant.status
                                }]);
                                setNewVariant({ name: '', price: '', status: 'ready' });
                              } else {
                                toast.error("Nama variasi harus diisi");
                              }
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" /> Tambah Variasi
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Always visible */}
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

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategoryFilter(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedCategoryFilter === null
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedCategoryFilter === cat
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            className="input-coffee pl-12"
            placeholder="Cari menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="card-elevated p-5 animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  {getCategoryIcon(item.category)}
                </div>
                {hasPermission('manage_menu') && (
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

              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display font-semibold text-lg">{item.name}</h3>
                {item.discount_percentage && item.discount_percentage > 0 && (
                  <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded">
                    -{item.discount_percentage}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-sm text-muted-foreground">{item.category}</p>
                <>
                  {item.status && (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${item.status === 'ready' ? 'bg-success/10 text-success' :
                      item.status === 'kosong' ? 'bg-destructive/10 text-destructive' :
                        'bg-warning/10 text-warning'
                      }`}>
                      {item.status === 'ready' ? 'Ready' : item.status === 'kosong' ? 'Kosong' : 'Pending'}
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Stock: {item.current_stock ?? item.stock ?? 0}
                  </span>
                </>
              </div>

              <div className="flex justify-between items-center mb-3">
                <div className="flex flex-col">
                  {item.discount_percentage && item.discount_percentage > 0 ? (
                    <>
                      <span className="text-sm text-muted-foreground line-through">{formatCurrency(item.price)}</span>
                      <span className="text-xl font-bold text-destructive">
                        {formatCurrency(item.price * (1 - item.discount_percentage / 100))}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-bold">{formatCurrency(item.price)}</span>
                  )}
                </div>
                <span className={`text-sm font-medium ${(item.margin || 0) >= 60 ? 'text-success' : 'text-warning'}`}>
                  {item.margin?.toFixed(0)}% margin
                </span>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">HPP:</span>
                  <span className="text-warning">{formatCurrency(item.cogs || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit:</span>
                  <span className="text-success font-semibold">{formatCurrency(item.profit || 0)}</span>
                </div>
              </div>

              {/* Ingredients preview */}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  Bahan ({item.menu_ingredients?.length || 0}):
                </p>
                {item.uses_ingredients === false ? (
                  <p className="text-xs text-muted-foreground italic">
                    Menu ini tidak menggunakan bahan baku
                  </p>
                ) : (item.menu_ingredients?.length || 0) > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.menu_ingredients?.slice(0, 3).map((ing, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-secondary rounded-full">
                        {ing.inventory_item?.name || 'Unknown'} {ing.amount}{ing.inventory_item?.unit || ''}
                      </span>
                    ))}
                    {(item.menu_ingredients?.length || 0) > 3 && (
                      <span className="text-xs px-2 py-1 bg-secondary rounded-full">
                        +{(item.menu_ingredients?.length || 0) - 3} lainnya
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Belum ada bahan ditambahkan
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Tidak ada menu ditemukan</p>
            {isAdmin() && !selectedStoreId && (
              <p className="text-sm text-muted-foreground mt-1">Simpan filter Toko ke 'Semua' atau pilih toko spesifik</p>
            )}
          </div>
        )}
      </div>
    </MainLayout >
  );
}
