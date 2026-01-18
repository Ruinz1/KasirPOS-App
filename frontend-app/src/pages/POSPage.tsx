import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency } from '@/utils/calculations';
import {
  Search,
  Coffee,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Check,
  Printer,
  Store as StoreIcon,
  ShoppingBag
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  cogs?: number;
  menu_ingredients?: Array<{
    inventory_item: {
      id: number;
      name: string;
      current_stock: number;
    };
    amount: number;
  }>;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface Order {
  id: number;
  daily_number?: number;
  customer_name: string;
  total: number;
  cogs: number;
  profit: number;
  payment_method: string;
  order_type?: 'dine_in' | 'takeaway';
  paid_amount?: number;
  change_amount?: number;
  created_at: string;
  items: Array<{
    menu_item: MenuItem;
    quantity: number;
    price: number;
  }>;
}

interface Store {
  id: number;
  name: string;
  location?: string;
}

export default function POSPage() {
  const { user, hasPermission, loading: authLoading, isAdmin, isOwner, isKaryawan } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qris'>('cash');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Admin Store Selection
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [storeInfo, setStoreInfo] = useState<{ name: string, address: string, image?: string }>({ name: 'KedaiPOS', address: '' });

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin()) {
        fetchStores();
      } else {
        fetchMenuItems();
        // Fetch store info for Owner/Karyawan
        fetchMyStore();
      }
    }
  }, [user, authLoading]);

  // Fetch menu when store selection changes for Admin
  useEffect(() => {
    if (isAdmin() && selectedStoreId) {
      const selected = stores.find(s => s.id.toString() === selectedStoreId);
      if (selected) {
        setStoreInfo({
          name: selected.name,
          address: selected.location || '',
          image: (selected as any).image || undefined
        });
      }
      fetchMenuItems();
      clearCart(); // Clear cart when switching stores
    }
  }, [selectedStoreId, stores]);

  const fetchMyStore = async () => {
    try {
      const res = await api.get('/store');
      setStoreInfo({
        name: res.data.name,
        address: res.data.location || '',
        image: res.data.image || undefined
      });
    } catch (err) {
      console.error("Failed to fetch store info", err);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await api.get('/stores-management');
      setStores(response.data.data || []);
      // Don't auto-select to force conscious choice? Or auto-select first?
      // Let's not auto-select to avoid accidental transactions on wrong store.
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (isAdmin() && selectedStoreId) {
        params.store_id = selectedStoreId;
      }

      const response = await api.get('/menu', { params });
      setMenuItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
      toast.error('Gagal memuat menu');
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(menuItems.map((m) => m.category))];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (item: MenuItem) => {
    const existing = cart.find((c) => c.menuItem.id === item.id);
    if (existing) {
      updateCartQuantity(item.id, existing.quantity + 1);
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: number) => {
    setCart(cart.filter((c) => c.menuItem.id !== itemId));
  };

  const updateCartQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map((c) =>
        c.menuItem.id === itemId ? { ...c, quantity } : c
      ));
    }
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setOrderType('dine_in');
    setPaidAmount('');
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  const cartCogs = cart.reduce((sum, item) => sum + ((item.menuItem.cogs || 0) * item.quantity), 0);
  const cartProfit = cartTotal - cartCogs;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }

    if (isAdmin() && !selectedStoreId) {
      toast.error('Pilih toko terlebih dahulu');
      return;
    }

    try {
      const payload: any = {
        customer_name: customerName || null,
        payment_method: paymentMethod,
        order_type: orderType,
        paid_amount: paidAmount ? parseFloat(paidAmount) : null,
        items: cart.map(c => ({
          menu_item_id: c.menuItem.id,
          quantity: c.quantity,
        })),
      };

      if (isAdmin()) {
        payload.store_id = selectedStoreId;
      }

      const response = await api.post('/orders', payload);
      setCurrentOrder(response.data);
      setShowPayment(false);
      setShowReceipt(true);
      clearCart();

      // Auto print after short delay to allow rendering
      setTimeout(() => {
        window.print();
      }, 500);

      toast.success('Transaksi berhasil', {
        description: `Total: ${formatCurrency(cartTotal)}`,
      });
    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error(error.response?.data?.error || 'Transaksi gagal');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="text-center py-12">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  // Access Control Logic
  const isKaryawanWithKasir = isKaryawan() && user?.positions?.some(p => p.toLowerCase() === 'kasir');
  const canAccessPOS = isAdmin() || isOwner() || isKaryawanWithKasir;

  if (!canAccessPOS) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <StoreIcon className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Anda tidak memiliki akses ke halaman Kasir. Hanya user dengan jabatan "Kasir" yang dapat mengakses halaman ini.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-full flex flex-col md:flex-row">
        {/* Left - Menu Selection */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-display font-bold">Kasir</h1>
              {isAdmin() && (
                <div className="w-[200px]">
                  <Select
                    value={selectedStoreId}
                    onValueChange={(val) => setSelectedStoreId(val)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Pilih Toko" />
                    </SelectTrigger>
                    <SelectContent>
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

            {isAdmin() && !selectedStoreId ? (
              <div className="flex flex-col items-center justify-center py-20 bg-secondary/20 rounded-xl border border-dashed border-border">
                <StoreIcon className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
                <p className="text-lg font-medium text-muted-foreground">Silakan Pilih Toko Terlebih Dahulu</p>
                <p className="text-sm text-muted-foreground">Pilih toko di pojok kanan atas untuk memulai transaksi</p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    className="input-coffee pl-12"
                    placeholder="Cari menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Categories */}
                <div className="flex gap-2 flex-wrap mb-6">
                  <button
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedCategory
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    onClick={() => setSelectedCategory(null)}
                  >
                    Semua
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                        }`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Menu Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {loading ? (
                    <div className="col-span-full text-center py-12">Loading menu...</div>
                  ) : filteredItems.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">Tidak ada menu ditemukan</div>
                  ) : (
                    filteredItems.map((item) => {
                      const inCart = cart.find((c) => c.menuItem.id === item.id);
                      const cartQty = inCart?.quantity || 0;

                      return (
                        <div
                          key={item.id}
                          className={`menu-card relative ${inCart ? 'border-primary ring-1 ring-primary/20' : ''}`}
                          onClick={() => addToCart(item)}
                        >
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                            <Coffee className="w-6 h-6 text-primary" />
                          </div>
                          <h3 className="font-medium text-sm line-clamp-2">{item.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                          <p className="font-bold mt-2">{formatCurrency(item.price)}</p>

                          {inCart && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                              {inCart.quantity}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right - Cart */}
        <div className="w-full md:w-96 bg-card border-l border-border flex flex-col h-[40vh] md:h-full shadow-lg md:shadow-none">
          <div className="p-6 border-b border-border">
            <h2 className="font-display font-semibold text-lg">Keranjang</h2>
            <p className="text-sm text-muted-foreground">{cart.length} item</p>
          </div>

          {/* Customer Name */}
          <div className="p-4 border-b border-border">
            <Input
              className="input-coffee"
              placeholder="Nama Pembeli (opsional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isAdmin() && !selectedStoreId}
            />
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Keranjang kosong</p>
                <p className="text-sm">Pilih menu untuk ditambahkan</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.menuItem.id} className="bg-secondary/50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.menuItem.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.menuItem.price)}
                      </p>
                    </div>
                    <button
                      className="p-1 hover:bg-destructive/10 rounded"
                      onClick={() => removeFromCart(item.menuItem.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-secondary"
                        onClick={() => updateCartQuantity(item.menuItem.id, item.quantity - 1)}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-secondary"
                        onClick={() => updateCartQuantity(item.menuItem.id, item.quantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(item.menuItem.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-border bg-secondary/30">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">HPP</span>
                  <span className="text-warning">{formatCurrency(cartCogs)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Profit</span>
                  <span className="text-success">{formatCurrency(cartProfit)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4 pt-3 border-t border-border">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold">{formatCurrency(cartTotal)}</span>
              </div>
              <button
                className="btn-accent w-full py-4 text-lg font-semibold"
                onClick={() => setShowPayment(true)}
              >
                Bayar
              </button>
            </div>
          )}
        </div>

        {/* Payment Dialog */}
        <Dialog open={showPayment} onOpenChange={setShowPayment}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-center">Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-center text-3xl font-bold mb-6">{formatCurrency(cartTotal)}</p>

              {/* Order Type */}
              <p className="text-sm text-muted-foreground mb-3">Tipe Pesanan</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  className={`p-4 rounded-xl border-2 transition-all ${orderType === 'dine_in'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => setOrderType('dine_in')}
                >
                  <Coffee className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <span className="text-sm font-medium">Dine In</span>
                </button>
                <button
                  className={`p-4 rounded-xl border-2 transition-all ${orderType === 'takeaway'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => setOrderType('takeaway')}
                >
                  <ShoppingBag className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <span className="text-sm font-medium">Takeaway</span>
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-3">Metode Pembayaran</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'cash'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Banknote className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <span className="text-sm font-medium">Cash</span>
                </button>
                <button
                  className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'card'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <span className="text-sm font-medium">Kartu</span>
                </button>
                <button
                  className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'qris'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    }`}
                  onClick={() => setPaymentMethod('qris')}
                >
                  <QrCode className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <span className="text-sm font-medium">QRIS</span>
                </button>
              </div>

              {/* Paid Amount (for cash) */}
              {paymentMethod === 'cash' && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Uang Dibayar</p>
                  <Input
                    type="number"
                    placeholder="Masukkan jumlah uang"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="input-coffee text-lg"
                  />
                  {paidAmount && parseFloat(paidAmount) >= cartTotal && (
                    <div className="mt-3 p-3 bg-success/10 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Kembalian:</span>
                        <span className="text-lg font-bold text-success">
                          {formatCurrency(parseFloat(paidAmount) - cartTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                  {paidAmount && parseFloat(paidAmount) < cartTotal && (
                    <p className="text-sm text-destructive mt-2">Uang tidak cukup</p>
                  )}
                </div>
              )}

              <button
                className="btn-primary w-full py-4 text-lg font-semibold flex items-center justify-center gap-2"
                onClick={handleCheckout}
                disabled={paymentMethod === 'cash' && paidAmount && parseFloat(paidAmount) < cartTotal}
              >
                <Check className="w-5 h-5" />
                Konfirmasi Pembayaran
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="sm:max-w-md">
            <div id="receipt-preview" className="p-0">
              {/* Header */}
              <div className="text-center mb-2">
                <div className="flex justify-center mb-1">
                  {storeInfo.image ? (
                    <img
                      src={`http://127.0.0.1:8000/storage/${storeInfo.image}`}
                      alt="Store Logo"
                      className="w-12 h-12 object-cover rounded-full"
                    />
                  ) : (
                    <StoreIcon className="w-6 h-6" strokeWidth={1.5} />
                  )}
                </div>
                <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">{storeInfo.name}</h1>
                {storeInfo.address && (
                  <p className="text-[10px] text-muted-foreground px-1 leading-tight mt-1">{storeInfo.address}</p>
                )}
              </div>

              {currentOrder && (
                <>
                  {/* Info */}
                  <div className="text-[10px] mb-2 pb-1 border-b border-dashed border-black">
                    <div className="flex justify-between mb-0.5">
                      <span>#{currentOrder.daily_number || currentOrder.id}</span>
                      <span>{new Date(currentOrder.created_at).toLocaleDateString('id-ID')} {new Date(currentOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kasir: {user?.name?.split(' ')[0]}</span>
                      <span className="capitalize">{(currentOrder as any).order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}</span>
                    </div>
                    {currentOrder.customer_name && (
                      <div className="mt-0.5 line-clamp-1">Plg: {currentOrder.customer_name}</div>
                    )}
                    <div className="mt-0.5 font-bold uppercase text-center border-t border-dashed border-black/50 pt-0.5 mt-1">
                      LUNAS
                    </div>
                  </div>

                  {/* Items */}
                  <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
                    {currentOrder.items.map((item, idx) => (
                      <div key={idx} className="text-[10px] leading-tight">
                        <div className="font-bold">{item.menu_item.name}</div>
                        <div className="flex justify-between">
                          <span>{item.quantity} x {formatCurrency(item.price)}</span>
                          <span className="font-semibold">{formatCurrency(item.quantity * item.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mb-2 text-[10px] space-y-0.5">
                    <div className="flex justify-between font-bold text-xs">
                      <span>TOTAL</span>
                      <span>{formatCurrency(currentOrder.total)}</span>
                    </div>
                    {(currentOrder as any).paid_amount && (
                      <>
                        <div className="flex justify-between">
                          <span>Dibayar</span>
                          <span>{formatCurrency((currentOrder as any).paid_amount)}</span>
                        </div>
                        {(currentOrder as any).change_amount && (
                          <div className="flex justify-between font-semibold">
                            <span>Kembalian</span>
                            <span>{formatCurrency((currentOrder as any).change_amount)}</span>
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
            </div>

            <div className="flex gap-3 px-6 pb-6 mt-4">
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
      </div>

      {/* Hidden Print Receipt - Outside Dialog to avoid transform issues */}
      <div id="receipt-print" className="hidden">
        {currentOrder && (
          <div className="p-0">
            {/* Header */}
            <div className="text-center mb-2">
              <div className="flex justify-center mb-1">
                {storeInfo.image ? (
                  <img
                    src={`http://127.0.0.1:8000/storage/${storeInfo.image}`}
                    alt="Store Logo"
                    className="w-12 h-12 object-cover rounded-full"
                  />
                ) : (
                  <StoreIcon className="w-6 h-6" strokeWidth={1.5} />
                )}
              </div>
              <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">{storeInfo.name}</h1>
              {storeInfo.address && (
                <p className="text-[10px] text-muted-foreground px-1 leading-tight mt-1">{storeInfo.address}</p>
              )}
            </div>

            {/* Info */}
            <div className="text-[10px] mb-2 pb-1 border-b border-dashed border-black">
              <div className="flex justify-between mb-0.5">
                <span>#{currentOrder.daily_number || currentOrder.id}</span>
                <span>{new Date(currentOrder.created_at).toLocaleDateString('id-ID')} {new Date(currentOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir: {user?.name?.split(' ')[0]}</span>
                <span className="capitalize">{(currentOrder as any).order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}</span>
              </div>
              {currentOrder.customer_name && (
                <div className="mt-0.5 line-clamp-1">Plg: {currentOrder.customer_name}</div>
              )}
              <div className="mt-0.5 font-bold uppercase text-center border-t border-dashed border-black/50 pt-0.5 mt-1">
                LUNAS
              </div>
            </div>

            {/* Items */}
            <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
              {currentOrder.items.map((item, idx) => (
                <div key={idx} className="text-[10px] leading-tight">
                  <div className="font-bold">{item.menu_item.name}</div>
                  <div className="flex justify-between">
                    <span>{item.quantity} x {formatCurrency(item.price)}</span>
                    <span className="font-semibold">{formatCurrency(item.quantity * item.price)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mb-2 text-[10px] space-y-0.5">
              <div className="flex justify-between font-bold text-xs">
                <span>TOTAL</span>
                <span>{formatCurrency(currentOrder.total)}</span>
              </div>
              {(currentOrder as any).paid_amount && (
                <>
                  <div className="flex justify-between">
                    <span>Dibayar</span>
                    <span>{formatCurrency((currentOrder as any).paid_amount)}</span>
                  </div>
                  {(currentOrder as any).change_amount && (
                    <div className="flex justify-between font-semibold">
                      <span>Kembalian</span>
                      <span>{formatCurrency((currentOrder as any).change_amount)}</span>
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
          </div>
        )}
      </div>

      {/* Print Styles for 58mm Thermal Printer */}
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
            padding: 0 6mm 5mm 6mm; /* 6mm safe margin on sides to prevent truncation */
            margin: 0;
            z-index: 9999;
            box-sizing: border-box; /* Ensure padding is included in width */
            font-family: 'Arial', sans-serif;
            font-size: 10px;
            line-height: 1.2;
            color: black;
            background: white;
          }

          #receipt-print h1 {
            font-size: 14px;
          }

          /* Ensure black text for thermal printers */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000 !important;
          }
          
          .text-muted-foreground {
              color: #000 !important;
          }
        }
        
        /* Screen Preview */
        #receipt-preview {
             font-family: 'Arial', sans-serif;
             width: 58mm;
             margin: 0 auto;
             border: 1px solid #eee;
        }
      `}</style>
    </MainLayout>
  );
}
