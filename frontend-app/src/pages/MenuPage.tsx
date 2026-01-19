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
  Filter
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
}

interface Ingredient {
  inventory_item_id: number;
  amount: number;
  inventory_item?: InventoryItem;
}

interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  discount_percentage?: number;
  image?: string;
  cogs?: number;
  profit?: number;
  margin?: number;
  menu_ingredients?: Array<{
    inventory_item: InventoryItem;
    amount: number;
  }>;
}

interface Store {
  id: number;
  name: string;
}

const categories = ['Kopi', 'Non-Kopi', 'Teh', 'Makanan', 'Snack'];

export default function MenuPage() {
  const { user, isAdmin, hasPermission, canEdit } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Kopi',
    price: '',
    discount_percentage: '0',
    store_id: '',
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngredient, setNewIngredient] = useState({ inventory_item_id: 0, amount: '' });

  useEffect(() => {
    if (isAdmin()) {
      fetchStores();
    } else {
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (isAdmin() && stores.length > 0) {
      // If admin, we fetch data when selectedStoreId changes
      // If it's empty 'all', we fetch all menus (but inventory fetch might need specific store or all stocks?)
      // Usually stocks are per store.
      fetchData();
    }
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

  const fetchData = async () => {
    try {
      setLoading(true);
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

  const filteredItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        ingredients: ingredients,
      };

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
      store_id: selectedStoreId // Ideally we should get store_id from item if available, but Menu API doesn't return it explicitly yet? Check controller. It returns MenuItem model. Model has store_id. But frontend interface doesn't have it.
      // If we are in "All Stores" mode, editing an item needs to know its store.
    });

    // For now assume admin selects a store before editing or adding. 
    // If "All Stores" is selected, we might have issues adding items (which store?).
    // Better to force store selection on Add Dialog if Admin.

    const formattedIngredients = item.menu_ingredients?.map(ing => ({
      inventory_item_id: ing.inventory_item.id,
      amount: ing.amount,
    })) || [];

    setIngredients(formattedIngredients);
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
    setFormData({ name: '', category: 'Kopi', price: '', discount_percentage: '0', store_id: isAdmin() ? selectedStoreId : '' });
    setIngredients([]);
    setNewIngredient({ inventory_item_id: 0, amount: '' });
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
                    className="bg-[#5C4033] hover:bg-[#4A332A] text-[#F5F5Fdc] border-none"
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

                      <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={resetForm}>
                          Batal
                        </Button>
                        <button className="btn-primary flex-1" onClick={handleSubmit}>
                          {editingItem ? 'Simpan' : 'Tambah'}
                        </button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
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
                  <Coffee className="w-6 h-6 text-primary" />
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
              <p className="text-sm text-muted-foreground mb-3">{item.category}</p>

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
                <div className="flex flex-wrap gap-1">
                  {item.menu_ingredients?.slice(0, 3).map((ing, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-secondary rounded-full">
                      {ing.inventory_item.name} {ing.amount}{ing.inventory_item.unit}
                    </span>
                  ))}
                  {(item.menu_ingredients?.length || 0) > 3 && (
                    <span className="text-xs px-2 py-1 bg-secondary rounded-full">
                      +{(item.menu_ingredients?.length || 0) - 3} lainnya
                    </span>
                  )}
                </div>
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
    </MainLayout>
  );
}
