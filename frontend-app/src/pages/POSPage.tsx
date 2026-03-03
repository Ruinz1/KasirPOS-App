import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency } from '@/utils/calculations';
import { useLocation } from 'react-router-dom';
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
  Clock,
  Printer,
  Store as StoreIcon,
  ShoppingBag,
  Utensils,
  GlassWater,
  Cookie,
  MessageSquare,
  ArrowUpAZ,
  ArrowDownAZ,
  ArrowUpDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Swal from 'sweetalert2';




interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  discount_percentage?: number;
  uses_ingredients?: boolean;
  status?: 'ready' | 'kosong' | 'pending';
  stock?: number;
  current_stock?: number;
  cogs?: number;
  menu_ingredients?: Array<{
    inventory_item: {
      id: number;
      name: string;
      current_stock: number;
    };
    amount: number;
  }>;
  variants?: Array<{
    name: string;
    price: number;
    status: 'ready' | 'kosong' | 'pending';
  }>;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  note?: string;
  is_takeaway?: boolean;
  variant?: string;
  variant_price?: number;
}

const BAKSO_VARIANTS = [
  { name: 'Kuah Coto', price: 0 },
  { name: 'Kuah Mercon', price: 0 },
  { name: 'Kuah Bening', price: 0 },
  { name: 'Kuah Rawon', price: 10000 },
  { name: 'Kuah Kaledo', price: 10000 },
];

interface Order {
  id: number;
  daily_number?: number;
  customer_name: string;
  total: number;
  cogs: number;
  profit: number;
  payment_method: string;
  payment_status?: 'paid' | 'pending';
  order_type?: 'dine_in' | 'takeaway';
  paid_amount?: number;
  change_amount?: number;
  initial_cash?: number;
  created_at: string;
  items: Array<{
    menu_item: MenuItem;
    quantity: number;
    price: number;
    note?: string;
    is_takeaway?: boolean;
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qris'>('cash');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [showPendingList, setShowPendingList] = useState(false);
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);

  // Admin Store Selection
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');


  const location = useLocation();
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [addToOrderId, setAddToOrderId] = useState<number | null>(null);
  const [receiptMode, setReceiptMode] = useState<'customer' | 'kitchen'>('customer');
  const [addedItemsForPrint, setAddedItemsForPrint] = useState<any[]>([]); // For printing only added items
  const [currentTime, setCurrentTime] = useState(new Date());

  // Table Management States
  const [showTableSelection, setShowTableSelection] = useState(false);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [pendingOrderForTable, setPendingOrderForTable] = useState<Order | null>(null);
  const [useTableSystem, setUseTableSystem] = useState(true); // Toggle untuk menggunakan sistem meja atau tidak
  const [preSelectedTableId, setPreSelectedTableId] = useState<number | null>(null); // Meja yang dipilih sebelum bayar

  // Split Bill States
  const [isSplitBill, setIsSplitBill] = useState(false);
  const [splitPayment1Method, setSplitPayment1Method] = useState<'cash' | 'card' | 'qris'>('cash');
  const [splitPayment1Amount, setSplitPayment1Amount] = useState<string>('');
  const [splitPayment2Method, setSplitPayment2Method] = useState<'cash' | 'card' | 'qris'>('qris');
  const [splitPayment2Amount, setSplitPayment2Amount] = useState<string>('');

  const generateKitchenCode = (name: string) => {
    // Split main part and variant part
    // Example: "Bakso Biasa (Kuah Mercon)" -> Main: "Bakso Biasa", Variant: "Kuah Mercon"
    const match = name.match(/^([^(]+)(?:\(([^)]+)\))?/);
    if (!match) return name.substring(0, 3).toUpperCase();

    const mainPart = match[1].trim();
    const variantPart = match[2]?.trim();

    // Initials: "Bakso Biasa" -> "BB"
    const initials = mainPart.split(/\s+/).map(w => w[0]?.toUpperCase()).join('');

    if (variantPart) {
      // Clean prefixes: remove "Kuah", "Level", "Rasa"
      const cleanVariant = variantPart.replace(/^(kuah|level|rasa)\s+/i, '');
      // Format: "Mercon"
      const formattedVariant = cleanVariant.charAt(0).toUpperCase() + cleanVariant.slice(1);
      return `${initials} -> ${formattedVariant}`;
    }

    return initials;
  };

  useEffect(() => {
    if (location.state?.editOrder) {
      const order = location.state.editOrder;
      setEditingOrderId(order.id);
      const customer = order.customer_name === 'Pelanggan Umum' ? '' : (order.customer_name || '');
      setCustomerName(customer);
      setOrderType(order.order_type || 'dine_in');
      setPaymentMethod(order.payment_method || 'cash');
      setPaidAmount(order.paid_amount ? String(order.paid_amount) : '');

      // Map items
      const cartItems: CartItem[] = order.items.map((item: any) => ({
        menuItem: item.menu_item,
        quantity: item.quantity,
        note: item.note,
        is_takeaway: !!item.is_takeaway
      }));
      setCart(cartItems);

      // Clear location state
      window.history.replaceState({}, '');
      toast.info(`Mengedit pesanan #${order.daily_number || order.id}`);
    }
  }, [location.state]);
  const [storeInfo, setStoreInfo] = useState<{ name: string, address: string, image?: string }>({ name: 'KedaiPOS', address: '' });

  const getCategoryIcon = (category: string) => {
    const className = "w-6 h-6 text-primary";
    const lowerCat = category?.toLowerCase() || '';
    if (lowerCat === 'makanan') return <Utensils className={className} />;
    if (lowerCat === 'snack') return <Cookie className={className} />;
    if (['minuman', 'non-kopi', 'teh'].includes(lowerCat)) return <GlassWater className={className} />;
    return <Coffee className={className} />;
  };

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
          image: (selected as any).image ? `/storage/${(selected as any).image}` : undefined
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
        image: res.data.image ? `/storage/${res.data.image}` : undefined
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

  const [activeOrdersList, setActiveOrdersList] = useState<Order[]>([]);
  const [listFilter, setListFilter] = useState<'pending' | 'paid'>('pending');
  // PendingOrders legacy state kept for compatibility or just use activeOrders filtr
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]); // Kept to avoid breaking references if any remain

  const fetchActiveOrders = async () => {
    try {
      const params: any = {};
      if (isAdmin() && selectedStoreId) {
        params.store_id = selectedStoreId;
      }

      const date = new Date();
      const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      params.start_date = today;

      const response = await api.get('/orders', { params });
      const allOrders = response.data;
      setActiveOrdersList(allOrders);

      // Update legacy state just in case
      const pending = allOrders.filter((o: Order) => o.payment_status === 'pending');
      setPendingOrders(pending);

      if (pending.length > 0 && !showPendingList) {
        // Toast managed elsewhere or removed to avoid spam
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const fetchPendingOrders = fetchActiveOrders; // Alias for compatibility

  // Fetch pending orders when component mounts or store changes
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin()) {
        if (selectedStoreId) {
          fetchPendingOrders();
        }
      } else {
        fetchPendingOrders();
      }
    }
  }, [user, authLoading, selectedStoreId]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Live polling for orders and menu (stock) - every 10 seconds
  useEffect(() => {
    if (authLoading || !user) return;
    if (isAdmin() && !selectedStoreId) return;

    const fetchLive = () => {
      fetchMenuItems(true); // Silent update
      fetchActiveOrders();
    };

    const intervalId = setInterval(fetchLive, 10000);

    return () => clearInterval(intervalId);
  }, [authLoading, user, selectedStoreId]);

  const fetchMenuItems = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = {};
      if (isAdmin() && selectedStoreId) {
        params.store_id = selectedStoreId;
      }

      const response = await api.get('/menu', { params });
      setMenuItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
      if (!silent) toast.error('Gagal memuat menu');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAvailableTables = async () => {
    try {
      const params: any = { status: 'available' };
      if (isAdmin() && selectedStoreId) {
        params.store_id = selectedStoreId;
      }
      const response = await api.get('/tables', { params });
      setAvailableTables(response.data);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      toast.error('Gagal memuat data meja');
    }
  };

  const handleAssignTable = async () => {
    if (!selectedTableId || !pendingOrderForTable) {
      toast.error('Pilih nomor meja terlebih dahulu');
      return;
    }

    try {
      await api.post(`/tables/${selectedTableId}/assign`, {
        order_id: pendingOrderForTable.id
      });

      toast.success('Nomor meja berhasil ditetapkan');
      setShowTableSelection(false);
      setSelectedTableId(null);
      setPendingOrderForTable(null);

      // Show receipt after table assignment
      setShowReceipt(true);
      setReceiptMode('customer');

      // Auto print
      setTimeout(() => {
        window.print();
      }, 500);

      fetchPendingOrders();
    } catch (error: any) {
      console.error('Failed to assign table:', error);
      toast.error(error.response?.data?.message || 'Gagal menetapkan meja');
    }
  };

  const categories = [...new Set(menuItems.map((m) => m.category))];

  const filteredItems = menuItems
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (!sortOrder) return 0;
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Helper to generate unique cart item key
  const getCartItemKey = (menuId: number, isTakeaway?: boolean, variant?: string) => {
    return `${menuId}_${isTakeaway ? 'takeaway' : 'dinein'}_${variant || 'none'}`;
  };

  // Helper to get variants (strictly from DB)
  const getItemVariants = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      return item.variants;
    }
    return []; // No implicit legacy variants
  };

  const addToCart = (item: MenuItem) => {
    const variants = getItemVariants(item);
    let variantPayload: { variant?: string; variant_price?: number } = {};

    if (variants.length > 0) {
      // Find default variant (first 'ready' one)
      const defaultVariant = variants.find(v => v.status === 'ready');

      if (defaultVariant) {
        variantPayload = {
          variant: defaultVariant.name,
          variant_price: defaultVariant.price
        };
      }
    }

    // Find existing item with same menu, takeaway status, and variant
    const existing = cart.find((c) =>
      c.menuItem.id === item.id &&
      c.is_takeaway === false && // Default is dine-in when adding
      c.variant === variantPayload.variant
    );

    if (existing) {
      // Increment quantity of existing matching item
      const existingKey = getCartItemKey(existing.menuItem.id, existing.is_takeaway, existing.variant);
      updateCartQuantity(existingKey, existing.quantity + 1);
    } else {
      setCart([...cart, { menuItem: item, quantity: 1, is_takeaway: false, ...variantPayload }]);
    }
  };

  const removeFromCart = (cartKey: string) => {
    setCart(cart.filter((c) => {
      const key = getCartItemKey(c.menuItem.id, c.is_takeaway, c.variant);
      return key !== cartKey;
    }));
  };

  const updateCartQuantity = (cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartKey);
    } else {
      setCart(cart.map((c) => {
        const key = getCartItemKey(c.menuItem.id, c.is_takeaway, c.variant);
        return key === cartKey ? { ...c, quantity } : c;
      }));
    }
  };

  const updateCartNote = (cartKey: string, note: string) => {
    setCart(cart.map((c) => {
      const key = getCartItemKey(c.menuItem.id, c.is_takeaway, c.variant);
      return key === cartKey ? { ...c, note } : c;
    }));
  };

  const updateCartVariant = (cartKey: string, variantName: string) => {
    setCart(prevCart => prevCart.map((c) => {
      const key = getCartItemKey(c.menuItem.id, c.is_takeaway, c.variant);
      if (key === cartKey) {
        const variants = getItemVariants(c.menuItem);
        const variantObj = variants.find(v => v.name === variantName);

        if (!variantObj) return c; // Invalid variant for this item

        // Logic (e.g. Bakso Iga exception) can be applied here too if needed, 
        // but if data is correct in DB/Legacy, we should trust variantObj.price directly?
        // Legacy Bakso Iga exception was: "price always 0".
        // If we move to DB variants, we can specify price 0 there.
        // For legacy text match, we can keep the exception or rely on BAKSO_VARIANTS config?
        // Let's keep the Iga exception for safety if using legacy variants, but strictly speaking 
        // if user configured variants in DB, they should set price 0.
        // I'll keep it simple: use variantObj.price.
        // Wait, legacy code had: `const isBaksoIga = c.menuItem.name.toLowerCase().includes('iga'); const finalPrice = isBaksoIga ? 0 : Number(variantObj.price);`
        // If I rely on `getItemVariants`, for legacy items, it returns `BAKSO_VARIANTS` which has prices.
        // So for "Bakso Iga" using legacy variants, it would get price 10000 for Rawon.
        // So I should keep the exception for now to avoid regression on hardcoded logic.

        let finalPrice = Number(variantObj.price);
        if (c.menuItem.name.toLowerCase().includes('iga') && !c.menuItem.variants?.length) {
          finalPrice = 0;
        }

        return {
          ...c,
          variant: variantName,
          variant_price: finalPrice
        };
      }
      return c;
    }));
  };

  const toggleCartTakeaway = (cartKey: string) => {
    setCart(cart.map((c) => {
      const key = getCartItemKey(c.menuItem.id, c.is_takeaway, c.variant);
      return key === cartKey ? { ...c, is_takeaway: !c.is_takeaway } : c;
    }));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setOrderType('dine_in');
    setPaidAmount('');
  };

  // Helper function to get discounted price
  const getDiscountedPrice = (item: MenuItem) => {
    const price = parseFloat(item.price as any);
    if (item.discount_percentage && item.discount_percentage > 0) {
      return price * (1 - item.discount_percentage / 100);
    }
    return price;
  };

  const cartTotal = cart.reduce((sum, item) => {
    const basePrice = getDiscountedPrice(item.menuItem);
    const variantPrice = Number(item.variant_price || 0);
    return sum + ((basePrice + variantPrice) * item.quantity);
  }, 0);
  const cartCogs = cart.reduce((sum, item) => sum + ((item.menuItem.cogs || 0) * item.quantity), 0);
  const cartProfit = cartTotal - cartCogs;

  const handleCheckout = async (paymentStatusOrEvent: 'paid' | 'pending' | React.MouseEvent | any = 'paid') => {
    // Handle if called directly from onClick (event object) or with specific status
    const paymentStatus = typeof paymentStatusOrEvent === 'string' ? paymentStatusOrEvent : 'paid';

    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }

    if (isAdmin() && !selectedStoreId) {
      toast.error('Pilih toko terlebih dahulu');
      return;
    }

    // Sweet Alert Confirmation
    let confirmTitle = paymentStatus === 'paid' ? 'Konfirmasi Pembayaran' : 'Simpan Pesanan?';
    let confirmBtnText = paymentStatus === 'paid' ? 'Ya, Proses' : 'Ya, Simpan';

    if (editingOrderId) {
      confirmTitle = 'Konfirmasi Update Pesanan';
      confirmBtnText = 'Update Pesanan';
    } else if (addToOrderId) {
      confirmTitle = 'Konfirmasi Tambahan Pesanan';
      confirmBtnText = 'Simpan Tambahan';
    }

    const result = await Swal.fire({
      title: confirmTitle,
      html: `
        <div class="text-left font-sans">
          <div class="mb-4 p-3 rounded-lg border flex flex-col items-center justify-center ${orderType === 'takeaway' ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700/50' : 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50'}">
             <span class="text-xs font-bold tracking-wider uppercase mb-1 ${orderType === 'takeaway' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}">Tipe Pesanan</span>
             <span class="text-xl font-extrabold ${orderType === 'takeaway' ? 'text-yellow-700 dark:text-yellow-300' : 'text-blue-700 dark:text-blue-300'}">
               ${orderType === 'takeaway' ? '📦 TAKE AWAY (BUNGKUS)' : '🍽️ DINE IN (MAKAN SINI)'}
             </span>
          </div>
          <p class="mb-3 font-semibold text-gray-700 dark:text-gray-300">Mohon cek kembali pesanan:</p>
          <div class="max-h-[40vh] overflow-y-auto mb-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-800">
            <ul class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              ${cart.map(item => {
        const itemPrice = (getDiscountedPrice(item.menuItem) + Number(item.variant_price || 0)) * item.quantity;
        return `
                <li class="flex justify-between border-b border-dashed border-gray-300 dark:border-gray-600 pb-1 last:border-0">
                  <div class="pr-2">
                    <span class="font-bold text-primary">${item.quantity}x</span> 
                    ${item.menuItem.name} 
                    ${item.variant ? `<br/><span class="text-xs text-muted-foreground ml-4">(${item.variant})</span>` : ''}
                    ${item.note ? `<br/><span class="text-xs text-muted-foreground ml-4 italic">"${item.note}"</span>` : ''}
                  </div>
                  <span class="font-medium whitespace-nowrap">${formatCurrency(itemPrice)}</span>
                </li>
                `
      }).join('')}
            </ul>
          </div>
          <div class="flex justify-between items-center text-lg font-bold border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
            <span>Total Tagihan:</span>
            <span class="text-primary">${formatCurrency(cartTotal)}</span>
          </div>
          ${paymentStatus === 'paid' && !editingOrderId && !addToOrderId ? `
            <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg mt-3 text-sm">
               <div class="flex justify-between items-center mb-1">
                 <span class="text-muted-foreground">Metode Pembayaran:</span>
                 <span class="font-bold uppercase">${paymentMethod}</span>
               </div>
               ${paymentMethod === 'cash' && paidAmount ? `
               <div class="flex justify-between items-center text-muted-foreground">
                 <span>Uang Diterima:</span>
                 <span>${formatCurrency(parseFloat(paidAmount))}</span>
               </div>
               ` : ''}
            </div>
          ` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: confirmBtnText,
      cancelButtonText: 'Batal',
      buttonsStyling: false,
      customClass: {
        popup: 'rounded-xl border border-border bg-card text-card-foreground shadow-lg font-sans',
        title: 'text-2xl font-bold text-foreground',
        htmlContainer: 'text-left text-foreground',
        confirmButton: 'btn-primary mx-1',
        cancelButton: 'btn-outline border-destructive/50 text-destructive hover:bg-destructive/10 mx-1'
      },
      focusConfirm: true,
      reverseButtons: true
    });

    if (!result.isConfirmed) {
      return;
    }


    const formatOrderItemsPayload = (cartItems: CartItem[]) => {
      return cartItems.map(c => {
        // Construct note with variant info
        const variantNote = c.variant ? `Kuah: ${c.variant}` : '';
        const userNote = c.note || '';
        const combinedNote = [variantNote, userNote].filter(Boolean).join('. ');

        return {
          menu_item_id: c.menuItem.id,
          quantity: c.quantity,
          note: combinedNote || null,
          is_takeaway: Boolean(c.is_takeaway),
          additional_price: Number(c.variant_price || 0)
        };
      });
    };

    try {
      // Check if we're editing an existing order
      if (editingOrderId) {
        // Update existing order
        const updatePayload = {
          customer_name: customerName || null,
          order_type: orderType,
          items: formatOrderItemsPayload(cart),
        };

        const response = await api.put(`/orders/${editingOrderId}/items`, updatePayload);
        setCurrentOrder(response.data);
        setShowPayment(false);
        setShowReceipt(true);
        setReceiptMode('customer');
        clearCart();
        setEditingOrderId(null);

        fetchPendingOrders();

        toast.success('Pesanan berhasil diupdate');

        // Auto print after short delay
        setTimeout(() => {
          window.print();
        }, 500);
      } else if (addToOrderId) {
        // ADDING ITEMS TO EXISTING ORDER
        const itemsPayload = formatOrderItemsPayload(cart);
        // Check for kitchen items (Non-Snack)
        const addedKitchenItems = cart.filter(c => {
          const cat = c.menuItem.category.toLowerCase();
          // Rule: Only non-snacks (Makanan, maybe others?) go to Queue
          // User said: "jika hanya snack tidak perlu" -> Only Queue if NOT just snack.
          // Implies: If it is Snack, don't queue. If it is Drink? Usually drinks go to bar.
          // Let's assume "Makanan" is the main kitchen item. 
          // "cukup pesanan bungkus saja" might mean "Just print the new batch".
          return cat === 'makanan' || c.menuItem.uses_ingredients;
        });

        // Prepare payload
        const payload = {
          items: itemsPayload
        };

        const response = await api.post(`/orders/${addToOrderId}/items`, payload);
        // Response contains { order, added_items }
        const updatedOrder = response.data.order;

        setCurrentOrder(updatedOrder);

        // Print Logic
        // 1. Kitchen Receipt (If needed) - Print First
        // 2. Then Open Payment Dialog (Langsung Bayar)

        const needsKitchenPrint = addedKitchenItems.length > 0;

        if (needsKitchenPrint) {
          setAddedItemsForPrint(cart); // Use current cart content as "Added Items" representation
          setReceiptMode('kitchen'); // Show kitchen receipt first for the NEW items
          toast.info('Pesanan tambahan dikirim ke dapur');

          // Wait for render then print, then open settle
          setTimeout(() => {
            window.print();

            // After print, open settlement
            setTimeout(() => {
              handleSettleOrder(updatedOrder);
            }, 1000);
          }, 500);
        } else {
          toast.info('Pesanan tambahan disimpan');
          handleSettleOrder(updatedOrder);
        }

        setShowPayment(false);
        // setShowReceipt(true); // Skip receipt, go to settle

        clearCart();
        setAddToOrderId(null);
        // fetchPendingOrders needs to run to update the list in background if needed, 
        // but we are opening the dialog directly so it's less critical immediately.
        fetchPendingOrders();

      } else {
        // Create new order
        // Jika Bayar Nanti (pending), payment_method = null supaya tidak tersimpan di DB
        const payload: any = {
          customer_name: customerName || null,
          payment_method: paymentStatus === 'pending' ? null : paymentMethod,
          payment_status: paymentStatus,
          order_type: orderType,
          paid_amount: paymentStatus === 'paid' ? (paidAmount ? parseFloat(paidAmount) : null) : null,
          items: formatOrderItemsPayload(cart),
        };

        if (isAdmin()) {
          payload.store_id = selectedStoreId;
        }

        const response = await api.post('/orders', payload);
        setCurrentOrder(response.data);
        setShowPayment(false);
        clearCart();
        setEditingOrderId(null);

        // Refresh pending orders if status is pending or generally to keep sync
        fetchPendingOrders();

        // For PAID DINE-IN orders with table system enabled, show table selection first
        if (paymentStatus === 'paid' && orderType === 'dine_in' && useTableSystem) {
          setPendingOrderForTable(response.data);
          await fetchAvailableTables();
          setShowTableSelection(true);
          toast.info('Pilih nomor meja untuk pesanan ini');
        } else {
          // For takeaway, pending orders, or when table system is disabled, show receipt directly
          setShowReceipt(true);
          setReceiptMode('customer');

          // Auto print after short delay to allow rendering (only for paid orders)
          if (paymentStatus === 'paid') {
            setTimeout(() => {
              window.print();
            }, 500);
          }
        }
      }
    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error(error.response?.data?.error || 'Transaksi gagal');
    }
  };

  const handleSettleOrder = (order: Order) => {
    setSettlingOrder(order);
    setPaymentMethod(order.payment_method as any || 'cash');
    setPaidAmount('');
    // Open settlement dialog (reuse payment dialog or create new one?)
    // Let's reuse Logic but inside a specific settlement confirmation
  };

  const confirmSettlement = async () => {
    if (!settlingOrder) return;

    try {
      // Adaptive Logic matches JSX:
      // If payment meets Full Total threshold, treat as Full Re-Payment (Reset).
      // If payment is Add-on, include Previous.

      const prevTotalPaid = settlingOrder.paid_amount || 0;
      const prevChange = settlingOrder.change_amount || 0;
      const effectivePrevPaid = prevTotalPaid - prevChange;

      const currentInput = paidAmount ? parseFloat(paidAmount) : (settlingOrder.total - effectivePrevPaid);
      const isFullPaymentMode = currentInput >= (settlingOrder.total - 100);

      const totalPaidCorrected = isFullPaymentMode ? currentInput : (effectivePrevPaid + currentInput);

      // For cash payment, check if amount is sufficient
      if (paymentMethod === 'cash' && totalPaidCorrected < settlingOrder.total) {
        toast.error('Uang yang dibayar kurang dari total tagihan');
        return;
      }

      // Update: Send 'currentInput' as paid_amount. 
      // The Backend Logic (Step 212) expects the "New Incoming Money" to detect Split Payment.
      // If we send Total (Sum), Backend treats it as Overwrite.

      const payload = {
        payment_status: 'paid',
        payment_method: paymentMethod,
        paid_amount: currentInput
      };

      const response = await api.put(`/orders/${settlingOrder.id}`, payload);
      setCurrentOrder(response.data);

      setSettlingOrder(null);

      // Check if payment was actually successful (backend might keep it pending)
      if (response.data.payment_status === 'paid') {
        setShowReceipt(true);
        setTimeout(() => {
          window.print();
        }, 500);
        toast.success('Pembayaran berhasil dikonfirmasi');
      } else {
        // Payment was insufficient, order remains pending
        toast.warning('Pembayaran kurang dari total. Pesanan masih dalam status pending.');
      }

      fetchPendingOrders();
    } catch (error: any) {
      console.error('Settlement failed:', error);
      toast.error('Gagal memproses pembayaran');
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



  // List Management
          {/* Active Orders List Dialog (Replaces Pending Only) */}
          <Dialog open={showPendingList} onOpenChange={setShowPendingList}>
            <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Daftar Pesanan Hari Ini</DialogTitle>
                <div className="flex gap-2 mt-4 bg-muted/50 p-1 rounded-lg">
                  <button
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${listFilter === 'pending' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setListFilter('pending')}
                  >
                    Belum Bayar ({activeOrdersList.filter(o => o.payment_status === 'pending').length})
                  </button>
                  <button
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${listFilter === 'paid' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setListFilter('paid')}
                  >
                    Sudah Bayar ({activeOrdersList.filter(o => o.payment_status === 'paid').length})
                  </button>
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {activeOrdersList.filter(o => listFilter === 'paid' ? o.payment_status === 'paid' : o.payment_status === 'pending').length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Tidak ada pesanan {listFilter === 'pending' ? 'pending' : 'selesai'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {activeOrdersList
                      .filter(o => listFilter === 'paid' ? o.payment_status === 'paid' : o.payment_status === 'pending')
                      .map((order) => (
                        <div key={order.id} className="bg-secondary/30 p-4 rounded-lg flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-bold text-lg">#{order.daily_number} - {order.customer_name || 'Tanpa Nama'}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(order.created_at).toLocaleString('id-ID')}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${order.payment_status === 'paid' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                                {order.payment_status === 'paid' ? 'LUNAS' : 'PENDING'}
                              </span>
                            </div>
                            <div className="space-y-1 mb-3">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="text-sm flex justify-between text-muted-foreground">
                                  <span>{item.quantity}x {item.menu_item.name}</span>
                                  <span>{formatCurrency(item.price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between font-bold pt-2 border-t border-border">
                              <span>Total</span>
                              <span>{formatCurrency(order.total)}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="btn-outline px-4 py-2 text-sm"
                              onClick={() => {
                                setAddToOrderId(order.id);
                                setCustomerName(order.customer_name || '');
                                setOrderType((order as any).order_type || 'dine_in');
                                setShowPendingList(false);
                                setCart([]); // Clear cart to start adding new items
                                toast.info(`Menambahkan pesanan untuk #${order.daily_number}`);
                              }}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Tambah
                            </button>
                            {order.payment_status === 'pending' && (
                              <button
                                className="btn-primary px-6 py-2"
                                onClick={() => {
                                  handleSettleOrder(order);
                                  setShowPendingList(false);
                                }}
                              >
                                Bayar Sekarang
                              </button>
                            )}
                            {order.payment_status === 'paid' && (
                              <button
                                className="btn-ghost px-4 py-2 text-sm"
                                onClick={() => {
                                  // Maybe view details or print?
                                  // For now just View logic if needed, or disable
                                  setCurrentOrder(order);
                                  setShowPendingList(false);
                                  setReceiptMode('customer');
                                  setShowReceipt(true);
                                }}
                              >
                                Lihat / Print
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Enhanced Settlement Dialog with Split Bill */}
          <Dialog open={!!settlingOrder} onOpenChange={(open) => !open && setSettlingOrder(null)}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-center text-2xl">
                  Konfirmasi Pembayaran
                </DialogTitle>
              </DialogHeader>
              {settlingOrder && (
                <div className="py-4 space-y-6">
                  {/* Bill Details Section */}
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 rounded-2xl p-5 border-2 border-primary/20">
                    <div className="text-center mb-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detail Tagihan</p>
                      <p className="text-sm font-medium text-muted-foreground mt-1">
                        {settlingOrder.customer_name || 'Pelanggan'} - #{settlingOrder.daily_number}
                      </p>
                    </div>

                    {/* Items List */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto border border-border">
                      <div className="space-y-3">
                        {settlingOrder.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {item.menu_item?.name || 'Item'}
                              </p>
                              {item.note && (
                                <p className="text-xs text-muted-foreground italic mt-0.5">
                                  {item.note}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatCurrency(item.price)} × {item.quantity}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-sm">
                                {formatCurrency(item.price * item.quantity)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total Section */}
                    <div className="bg-primary/10 dark:bg-primary/20 rounded-xl p-4 border-2 border-primary/30">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold uppercase tracking-wide">Total Tagihan</span>
                        <span className="text-3xl font-black text-primary">
                          {formatCurrency(settlingOrder.total)}
                        </span>
                      </div>
                      {settlingOrder.items.length > 1 && (
                        <p className="text-xs text-muted-foreground mt-2 text-right">
                          {settlingOrder.items.length} item · {settlingOrder.items.reduce((sum, item) => sum + item.quantity, 0)} porsi
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Split Bill Toggle */}
                  <div className="flex items-center justify-center gap-3 p-4 bg-muted/30 rounded-xl">
                    <span className="text-sm font-medium">Pembayaran Tunggal</span>
                    <button
                      onClick={() => {
                        setIsSplitBill(!isSplitBill);
                        if (!isSplitBill) {
                          // Reset amounts when enabling split
                          setSplitPayment1Amount('');
                          setSplitPayment2Amount('');
                        } else {
                          // Reset to single payment
                          setPaidAmount('');
                        }
                      }}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${isSplitBill ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isSplitBill ? 'translate-x-8' : 'translate-x-1'
                          }`}
                      />
                    </button>
                    <span className="text-sm font-medium">Split Bill</span>
                  </div>

                  {!isSplitBill ? (
                    /* Single Payment Mode */
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground mb-3 font-medium">Metode Pembayaran</p>
                        <div className="grid grid-cols-3 gap-3">
                          <button
                            className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'cash'
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border hover:border-primary/50'
                              }`}
                            onClick={() => setPaymentMethod('cash')}
                          >
                            <Banknote className="w-7 h-7 mx-auto mb-2 text-primary" />
                            <span className="text-sm font-semibold">Cash</span>
                          </button>
                          <button
                            className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'card'
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border hover:border-primary/50'
                              }`}
                            onClick={() => setPaymentMethod('card')}
                          >
                            <CreditCard className="w-7 h-7 mx-auto mb-2 text-primary" />
                            <span className="text-sm font-semibold">Kartu</span>
                          </button>
                          <button
                            className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'qris'
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border hover:border-primary/50'
                              }`}
                            onClick={() => setPaymentMethod('qris')}
                          >
                            <QrCode className="w-7 h-7 mx-auto mb-2 text-primary" />
                            <span className="text-sm font-semibold">QRIS</span>
                          </button>
                        </div>
                      </div>

                      {paymentMethod === 'cash' && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2 font-medium">Uang Dibayar</p>
                          <Input
                            type="number"
                            placeholder="Masukkan jumlah uang"
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            className="input-coffee text-lg mb-3"
                            autoFocus
                          />

                          {/* Quick Amount Buttons */}
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {[20000, 50000, 100000, 200000].map((amount) => (
                              <button
                                key={amount}
                                onClick={() => setPaidAmount(String(amount))}
                                className="px-3 py-2 text-xs font-semibold rounded-lg border-2 border-primary/30 hover:border-primary hover:bg-primary/10 transition-all"
                              >
                                {formatCurrency(amount)}
                              </button>
                            ))}
                          </div>

                          {/* Change Display */}
                          {(() => {
                            const current = parseFloat(paidAmount || '0');
                            const change = current - settlingOrder.total;

                            if (paidAmount && current >= settlingOrder.total) {
                              return (
                                <div className="p-4 bg-success/10 rounded-xl border-2 border-success/30">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold">Kembalian:</span>
                                    <span className="text-2xl font-bold text-success">
                                      {formatCurrency(change)}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            if (paidAmount && current < settlingOrder.total) {
                              return (
                                <p className="text-sm text-destructive font-medium">
                                  Masih kurang: {formatCurrency(Math.abs(change))}
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      {/* Single Payment Button */}
                      <button
                        className="btn-primary w-full py-4 text-lg font-bold flex items-center justify-center gap-2 shadow-lg"
                        onClick={confirmSettlement}
                        disabled={paymentMethod === 'cash' && parseFloat(paidAmount || '0') < settlingOrder.total}
                      >
                        <Check className="w-6 h-6" />
                        Konfirmasi Pembayaran
                      </button>
                    </>
                  ) : (
                    /* Split Bill Mode */
                    <>
                      {/* Payment 1 */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-3">Pembayaran Pertama</p>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <button
                            className={`p-3 rounded-lg border-2 transition-all ${splitPayment1Method === 'cash'
                              ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                              }`}
                            onClick={() => setSplitPayment1Method('cash')}
                          >
                            <Banknote className="w-5 h-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold">Cash</span>
                          </button>
                          <button
                            className={`p-3 rounded-lg border-2 transition-all ${splitPayment1Method === 'card'
                              ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                              }`}
                            onClick={() => setSplitPayment1Method('card')}
                          >
                            <CreditCard className="w-5 h-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold">Kartu</span>
                          </button>
                          <button
                            className={`p-3 rounded-lg border-2 transition-all ${splitPayment1Method === 'qris'
                              ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                              }`}
                            onClick={() => setSplitPayment1Method('qris')}
                          >
                            <QrCode className="w-5 h-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold">QRIS</span>
                          </button>
                        </div>

                        <Input
                          type="number"
                          placeholder="Jumlah pembayaran pertama"
                          value={splitPayment1Amount}
                          onChange={(e) => setSplitPayment1Amount(e.target.value)}
                          className="input-coffee"
                        />

                        {/* Quick buttons for split payment 1 */}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {[Math.floor(settlingOrder.total / 2), Math.floor(settlingOrder.total * 0.3), Math.floor(settlingOrder.total * 0.7)].map((amount, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSplitPayment1Amount(String(amount))}
                              className="px-2 py-1 text-xs font-semibold rounded border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all"
                            >
                              {idx === 0 ? '50%' : idx === 1 ? '30%' : '70%'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Payment 2 */}
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border-2 border-green-200 dark:border-green-800">
                        <p className="text-sm font-bold text-green-700 dark:text-green-400 mb-3">Pembayaran Kedua</p>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <button
                            className={`p-3 rounded-lg border-2 transition-all ${splitPayment2Method === 'cash'
                              ? 'border-green-500 bg-green-100 dark:bg-green-900/50'
                              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                              }`}
                            onClick={() => setSplitPayment2Method('cash')}
                          >
                            <Banknote className="w-5 h-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                            <span className="text-xs font-semibold">Cash</span>
                          </button>
                          <button
                            className={`p-3 rounded-lg border-2 transition-all ${splitPayment2Method === 'card'
                              ? 'border-green-500 bg-green-100 dark:bg-green-900/50'
                              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                              }`}
                            onClick={() => setSplitPayment2Method('card')}
                          >
                            <CreditCard className="w-5 h-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                            <span className="text-xs font-semibold">Kartu</span>
                          </button>
                          <button
                            className={`p-3 rounded-lg border-2 transition-all ${splitPayment2Method === 'qris'
                              ? 'border-green-500 bg-green-100 dark:bg-green-900/50'
                              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                              }`}
                            onClick={() => setSplitPayment2Method('qris')}
                          >
                            <QrCode className="w-5 h-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                            <span className="text-xs font-semibold">QRIS</span>
                          </button>
                        </div>

                        <Input
                          type="number"
                          placeholder="Jumlah pembayaran kedua"
                          value={splitPayment2Amount}
                          onChange={(e) => setSplitPayment2Amount(e.target.value)}
                          className="input-coffee"
                        />

                        {/* Auto-calculate remaining */}
                        {splitPayment1Amount && (
                          <button
                            onClick={() => {
                              const remaining = settlingOrder.total - parseFloat(splitPayment1Amount || '0');
                              if (remaining > 0) {
                                setSplitPayment2Amount(String(remaining));
                              }
                            }}
                            className="mt-2 w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50 transition-all"
                          >
                            Isi Sisa ({formatCurrency(Math.max(0, settlingOrder.total - parseFloat(splitPayment1Amount || '0')))})
                          </button>
                        )}
                      </div>

                      {/* Split Bill Summary with Visual Progress */}
                      {(() => {
                        const amount1 = parseFloat(splitPayment1Amount || '0');
                        const amount2 = parseFloat(splitPayment2Amount || '0');
                        const total = amount1 + amount2;
                        const difference = total - settlingOrder.total;
                        const percentage1 = total > 0 ? (amount1 / total) * 100 : 0;
                        const percentage2 = total > 0 ? (amount2 / total) * 100 : 0;

                        return (
                          <div className="space-y-4">
                            {/* Visual Progress Bar */}
                            {(amount1 > 0 || amount2 > 0) && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                                  Proporsi Pembayaran
                                </p>
                                <div className="h-12 flex rounded-xl overflow-hidden border-2 border-border shadow-inner">
                                  {amount1 > 0 && (
                                    <div
                                      className="bg-gradient-to-r from-blue-400 to-blue-500 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center transition-all duration-300"
                                      style={{ width: `${percentage1}%` }}
                                    >
                                      {percentage1 > 15 && (
                                        <span className="text-xs font-bold text-white">
                                          {percentage1.toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {amount2 > 0 && (
                                    <div
                                      className="bg-gradient-to-r from-green-400 to-green-500 dark:from-green-600 dark:to-green-700 flex items-center justify-center transition-all duration-300"
                                      style={{ width: `${percentage2}%` }}
                                    >
                                      {percentage2 > 15 && (
                                        <span className="text-xs font-bold text-white">
                                          {percentage2.toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                    {splitPayment1Method.toUpperCase()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                    {splitPayment2Method.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Detailed Breakdown */}
                            <div className="p-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl border-2 border-border shadow-sm">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 text-center">
                                Ringkasan Pembayaran
                              </p>
                              <div className="space-y-2.5 text-sm">
                                <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="font-medium">Pembayaran 1</span>
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded-full font-semibold">
                                      {splitPayment1Method.toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="font-bold text-blue-700 dark:text-blue-400">
                                    {formatCurrency(amount1)}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="font-medium">Pembayaran 2</span>
                                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/50 rounded-full font-semibold">
                                      {splitPayment2Method.toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="font-bold text-green-700 dark:text-green-400">
                                    {formatCurrency(amount2)}
                                  </span>
                                </div>

                                <div className="border-t-2 border-dashed border-border pt-2.5 mt-2">
                                  <div className="flex justify-between items-center font-bold text-base">
                                    <span>Total Dibayar:</span>
                                    <span className={difference >= 0 ? 'text-success text-lg' : 'text-destructive text-lg'}>
                                      {formatCurrency(total)}
                                    </span>
                                  </div>
                                </div>

                                {difference !== 0 && (
                                  <div className={`flex justify-between items-center p-2.5 rounded-lg ${difference > 0
                                    ? 'bg-success/10 border border-success/30'
                                    : 'bg-destructive/10 border border-destructive/30'
                                    }`}>
                                    <span className="font-semibold text-sm">
                                      {difference > 0 ? '💰 Kembalian:' : '⚠️ Kurang Bayar:'}
                                    </span>
                                    <span className={`font-black text-lg ${difference > 0 ? 'text-success' : 'text-destructive'
                                      }`}>
                                      {formatCurrency(Math.abs(difference))}
                                    </span>
                                  </div>
                                )}

                                {/* Target Bill Comparison */}
                                <div className="mt-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Target Tagihan:</span>
                                    <span className="font-bold text-primary">{formatCurrency(settlingOrder.total)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Split Bill Confirm Button */}
                      <button
                        className="btn-primary w-full py-4 text-lg font-bold flex items-center justify-center gap-2 shadow-lg"
                        onClick={async () => {
                          try {
                            const amount1 = parseFloat(splitPayment1Amount || '0');
                            const amount2 = parseFloat(splitPayment2Amount || '0');
                            const total = amount1 + amount2;

                            if (total < settlingOrder.total) {
                              toast.error('Total pembayaran kurang dari tagihan');
                              return;
                            }

                            if (amount1 <= 0 || amount2 <= 0) {
                              toast.error('Kedua pembayaran harus diisi');
                              return;
                            }

                            // Send split payment to backend
                            const payload = {
                              payment_status: 'paid',
                              payment_method: splitPayment1Method,
                              paid_amount: amount1,
                              second_payment_method: splitPayment2Method,
                              second_paid_amount: amount2
                            };

                            await api.put(`/orders/${settlingOrder.id}`, payload);

                            setSettlingOrder(null);
                            fetchPendingOrders();

                            // Reset split bill states
                            setIsSplitBill(false);
                            setSplitPayment1Amount('');
                            setSplitPayment2Amount('');

                            toast.success(`Pembayaran berhasil! Split: ${formatCurrency(amount1)} (${splitPayment1Method.toUpperCase()}) + ${formatCurrency(amount2)} (${splitPayment2Method.toUpperCase()})`);
                          } catch (error) {
                            toast.error('Gagal memproses pembayaran');
                          }
                        }}
                        disabled={(() => {
                          const amount1 = parseFloat(splitPayment1Amount || '0');
                          const amount2 = parseFloat(splitPayment2Amount || '0');
                          return (amount1 + amount2) < settlingOrder.total || amount1 <= 0 || amount2 <= 0;
                        })()}
                      >
                        <Check className="w-6 h-6" />
                        Konfirmasi Split Bill
                      </button>
                    </>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          <div className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-display font-bold">Kasir</h1>
                  {editingOrderId && (
                    <span className="px-3 py-1 bg-warning/20 text-warning text-xs font-bold rounded-full border border-warning/50">
                      MODE EDIT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span className="mx-1">•</span>
                  <span className="font-mono font-semibold text-primary">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="relative p-2 rounded-full hover:bg-secondary transition-colors"
                  onClick={() => setShowPendingList(true)}
                  title="Pesanan Pending"
                >
                  <Clock className={`w-5 h-5 ${pendingOrders.length > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                  {pendingOrders.length > 0 && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-destructive text-[8px] text-white flex items-center justify-center rounded-full font-bold">
                      {pendingOrders.length}
                    </span>
                  )}
                </button>
              </div>
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

                {/* Sort Button */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortOrder
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    onClick={() => {
                      if (!sortOrder) {
                        setSortOrder('asc');
                      } else if (sortOrder === 'asc') {
                        setSortOrder('desc');
                      } else {
                        setSortOrder(null);
                      }
                    }}
                  >
                    {!sortOrder && (
                      <>
                        <ArrowUpDown className="w-4 h-4" />
                        <span>Urutkan Nama</span>
                      </>
                    )}
                    {sortOrder === 'asc' && (
                      <>
                        <ArrowUpAZ className="w-4 h-4" />
                        <span>A-Z</span>
                      </>
                    )}
                    {sortOrder === 'desc' && (
                      <>
                        <ArrowDownAZ className="w-4 h-4" />
                        <span>Z-A</span>
                      </>
                    )}
                  </button>
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
                      const isKosong = item.status === 'kosong';
                      const isPending = item.status === 'pending';

                      return (
                        <div
                          key={item.id}
                          className={`menu-card relative ${inCart ? 'border-primary ring-1 ring-primary/20' : ''} ${isKosong ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          onClick={() => !isKosong && addToCart(item)}
                        >
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                            {getCategoryIcon(item.category)}
                          </div>
                          <h3 className="font-medium text-sm line-clamp-2">{item.name}</h3>
                          <div className="flex items-center gap-1 mt-1">
                            <p className="text-xs text-muted-foreground">{item.category}</p>
                            {item.status && (
                              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.status === 'ready' ? 'bg-success/10 text-success' :
                                item.status === 'kosong' ? 'bg-destructive/10 text-destructive' :
                                  'bg-warning/10 text-warning'
                                }`}>
                                {item.status === 'ready' ? 'Ready' : item.status === 'kosong' ? 'Kosong' : 'Pending'}
                              </span>
                            )}
                            {/* Show stock if low? Or always? */}
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              Stock: {item.current_stock ?? item.stock ?? 0}
                            </span>
                          </div>

                          {item.discount_percentage && item.discount_percentage > 0 ? (
                            <div className="mt-2">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs line-through text-muted-foreground">{formatCurrency(item.price)}</span>
                                <span className="px-1 py-0.5 bg-destructive/10 text-destructive text-[10px] font-semibold rounded">-{item.discount_percentage}%</span>
                              </div>
                              <p className="font-bold text-destructive">{formatCurrency(getDiscountedPrice(item))}</p>
                            </div>
                          ) : (
                            <p className="font-bold mt-2">{formatCurrency(item.price)}</p>
                          )}

                          {isKosong && (
                            <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                              <span className="text-xs font-semibold text-destructive">Tidak Tersedia</span>
                            </div>
                          )}

                          {isPending && !isKosong && (
                            <div className="mt-1">
                              <p className="text-[10px] text-warning">⏱ Perlu waktu tunggu</p>
                            </div>
                          )}

                          {inCart && !isKosong && (
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
                {storeInfo.image ? (
                  <img
                    src={storeInfo.image}
                    alt="Logo Toko"
                    className="w-20 h-20 mx-auto mb-3 opacity-80 object-contain"
                  />
                ) : (
                  <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
                )}
                <p>Keranjang kosong</p>
                <p className="text-sm">Pilih menu untuk ditambahkan</p>
              </div>
            ) : (
              cart.map((item) => {
                const cartKey = getCartItemKey(item.menuItem.id, item.is_takeaway, item.variant);

                return (
                  <div key={cartKey} className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.menuItem.name}</h4>
                        {item.menuItem.discount_percentage && item.menuItem.discount_percentage > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs line-through text-muted-foreground">{formatCurrency(item.menuItem.price)}</span>
                            <span className="text-sm text-destructive font-semibold">
                              {formatCurrency(getDiscountedPrice(item.menuItem))}
                            </span>
                            <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] font-semibold rounded">-{item.menuItem.discount_percentage}%</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.menuItem.price)}
                          </p>
                        )}
                      </div>
                      <button
                        className="p-1 hover:bg-destructive/10 rounded"
                        onClick={() => removeFromCart(cartKey)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>

                    {/* Options Row */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => toggleCartTakeaway(cartKey)}
                        className={`p-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors ${item.is_takeaway
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-secondary border border-border text-muted-foreground'
                          }`}
                        title={item.is_takeaway ? "Dibungkus" : "Makan di tempat"}
                      >
                        {item.is_takeaway ? <ShoppingBag className="w-3 h-3" /> : <Utensils className="w-3 h-3" />}
                        {item.is_takeaway ? 'Bungkus' : 'Makan'}
                      </button>

                      <div className="flex-1 relative">
                        <div className="absolute left-2 top-1/2 -translate-y-1/2">
                          <MessageSquare className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <Input
                          className="h-7 text-xs pl-7 bg-background border-border"
                          placeholder="Catatan..."
                          value={item.note || ''}
                          onChange={(e) => updateCartNote(cartKey, e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Variant Selection for Bakso */}
                    {/* Variant Selection */}
                    {getItemVariants(item.menuItem).length > 0 && (
                      <div className="mb-3">
                        <Select
                          value={item.variant || ''}
                          onValueChange={(val) => updateCartVariant(cartKey, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-full bg-background border-border">
                            <div className="flex justify-between w-full pr-2">
                              <span>{item.variant || 'Pilih Variasi'}</span>
                              {item.variant_price && item.variant_price > 0 ? (
                                <span className="font-semibold text-primary">+{formatCurrency(item.variant_price)}</span>
                              ) : null}
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {getItemVariants(item.menuItem).map((v) => {
                              // Legacy Iga logic
                              const isIga = item.menuItem.name.toLowerCase().includes('iga') && !item.menuItem.variants?.length;
                              const displayPrice = isIga ? 0 : v.price;
                              const isKosong = v.status === 'kosong';

                              return (
                                <SelectItem key={v.name} value={v.name} className="text-xs" disabled={isKosong}>
                                  <span className={isKosong ? "line-through opacity-50" : ""}>
                                    {v.name}
                                    {displayPrice > 0 ? ` (+${formatCurrency(displayPrice)})` : ''}
                                    {v.status && v.status !== 'ready' && ` (${v.status})`}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-secondary"
                          onClick={() => updateCartQuantity(cartKey, item.quantity - 1)}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <button
                          className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-secondary"
                          onClick={() => updateCartQuantity(cartKey, item.quantity + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency((getDiscountedPrice(item.menuItem) + Number(item.variant_price || 0)) * item.quantity)}
                      </span>
                    </div>
                  </div>
                )
              })
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
              {(editingOrderId || addToOrderId) && (
                <button
                  className="w-full py-2 mb-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => {
                    setEditingOrderId(null);
                    setAddToOrderId(null);
                    clearCart();
                    toast.info('Mode edit/tambah dibatalkan');
                  }}
                >
                  Batal {editingOrderId ? 'Edit' : 'Tambah'}
                </button>
              )}
              <button
                className="btn-accent w-full py-4 text-lg font-semibold"
                onClick={() => {
                  if (editingOrderId) {
                    handleCheckout('paid');
                  } else if (addToOrderId) {
                    handleCheckout('paid');
                  } else {
                    setShowPayment(true);
                  }
                }}
              >
                {editingOrderId ? 'Update Pesanan' : addToOrderId ? 'Simpan Tambahan' : 'Bayar'}
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

              {/* Table System Toggle - Only show for Dine In */}
              {orderType === 'dine_in' && (
                <div className="mb-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 border-border bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${useTableSystem ? 'bg-primary/10' : 'bg-muted'}`}>
                        {useTableSystem ? (
                          <Utensils className="w-5 h-5 text-primary" />
                        ) : (
                          <Clock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {useTableSystem ? 'Sistem Meja' : 'Antrian Biasa'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {useTableSystem
                            ? 'Pilih nomor meja setelah bayar'
                            : 'Langsung ke antrian tanpa meja'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUseTableSystem(!useTableSystem)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useTableSystem ? 'bg-primary' : 'bg-muted'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useTableSystem ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              )}

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

              <div className="grid grid-cols-2 gap-3">
                <button
                  className="btn-outline py-4 text-lg font-semibold flex items-center justify-center gap-2"
                  onClick={() => handleCheckout('pending')}
                >
                  <Clock className="w-5 h-5" />
                  Bayar Nanti
                </button>
                <button
                  className="btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2"
                  onClick={() => handleCheckout('paid')}
                  disabled={paymentMethod === 'cash' && paidAmount && parseFloat(paidAmount) < cartTotal}
                >
                  <Check className="w-5 h-5" />
                  {editingOrderId ? 'Simpan Perubahan' : 'Bayar Sekarang'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="sm:max-w-md">
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
                    {currentOrder && (
                      <>
                        <p className="text-lg font-bold">#{currentOrder.daily_number || currentOrder.id}</p>
                        <p className="uppercase text-sm font-bold mt-1">
                          {(currentOrder as any).order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY'}
                        </p>
                        <p className="font-bold text-md mt-1 truncate">{currentOrder.customer_name || 'Pelanggan'}</p>
                        <div className="text-[10px] mt-1 text-left flex justify-between">
                          <span>{new Date(currentOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>Kasir: {user?.name?.split(' ')[0]}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4">
                    {currentOrder?.items.map((item, idx) => {
                      // Parse note to extract variant and user note
                      const noteText = (item as any).note || '';
                      const variantMatch = noteText.match(/Kuah: ([^.]+)/);
                      const variant = variantMatch ? variantMatch[1].trim() : null;
                      const userNote = noteText.replace(/Kuah: [^.]+\.?\s*/, '').trim();

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
                                {variant && (
                                  <span className="font-bold text-sm border-2 border-black inline-block px-1.5 py-0.5 rounded-sm bg-yellow-100">
                                    {variant}
                                  </span>
                                )}
                                {(item as any).is_takeaway && (
                                  <span className="font-bold text-xs border-2 border-black inline-block px-1 rounded-sm">BUNGKUS</span>
                                )}
                                {userNote && (
                                  <span className="text-sm font-bold italic bg-black text-white px-1 rounded-sm">
                                    Note: {userNote}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                // CUSTOMER RECEIPT PREVIEW
                <>
                  {/* Header */}
                  <div className="text-center mb-2">
                    <div className="flex justify-center mb-1">
                      {storeInfo.image ? (
                        <img
                          src={`/storage/${storeInfo.image}`}
                          alt="Store Logo"
                          className="w-12 h-12 object-cover rounded-full"
                        />
                      ) : (
                        <StoreIcon className="w-6 h-6" strokeWidth={1.5} />
                      )}
                    </div>
                    <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">
                      {storeInfo.name}
                    </h1>
                    {storeInfo.address && (
                      <p className="text-[10px] text-muted-foreground px-1 leading-tight mt-1">
                        {storeInfo.address}
                      </p>
                    )}
                  </div>

                  {currentOrder && (
                    <>
                      {/* Info */}
                      <div className="text-[10px] mb-2 pb-1 border-b border-dashed border-black">
                        <div className="flex justify-between mb-0.5">
                          <span>#{(currentOrder as any).daily_number || currentOrder.id}</span>
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
                          {currentOrder.status === 'cancelled' ? 'BATAL' : (currentOrder.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR')}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
                        {currentOrder.items?.map((item: any, idx: number) => {
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
                </>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6 mt-4">
              <button
                className="btn-outline flex-1"
                onClick={() => {
                  setShowReceipt(false);
                  setAddedItemsForPrint([]); // Clear added items state
                }}
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
        {currentOrder && receiptMode === 'kitchen' ? (
          // KITCHEN PRINT
          <div className="p-1 font-mono">
            <div className="text-center mb-3 pb-2 border-b-2 border-dashed border-black">
              <h2 className="text-xl font-bold">DAPUR {addedItemsForPrint.length > 0 ? '(TAMBAHAN)' : ''}</h2>
              <p className="text-lg font-bold">#{currentOrder.daily_number || currentOrder.id}</p>
              <p className="uppercase text-sm font-bold mt-1">
                {(currentOrder as any).order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY'}
              </p>
              <p className="font-bold text-md mt-1 truncate">{currentOrder.customer_name || 'Pelanggan'}</p>
              <div className="text-[10px] mt-1 text-left flex justify-between">
                <span>{new Date(currentOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{user?.name?.split(' ')[0]}</span>
              </div>
            </div>
            <div className="space-y-4">
              {/* If addedItemsForPrint exists, ONLY print those. Else print all? Usually updates print diff. */}
              {(addedItemsForPrint.length > 0 ? addedItemsForPrint.map((c: any) => ({ ...c, menu_item: c.menuItem })) : currentOrder.items).map((item, idx) => {
                // Parse note to extract variant and user note
                const noteText = (item as any).note || '';
                const variantMatch = noteText.match(/Kuah: ([^.]+)/);
                const variant = variantMatch ? variantMatch[1].trim() : null;
                const userNote = noteText.replace(/Kuah: [^.]+\.?\s*/, '').trim();

                return (
                  <div key={idx} className="border-b border-dashed border-black/20 pb-2 last:border-0">
                    <div className="flex gap-3 items-start">
                      <span className="font-bold text-2xl w-8 text-center leading-none mt-1">{item.quantity}</span>
                      <div className="flex-1">
                        <p className="font-bold text-xl leading-tight">
                          {generateKitchenCode(item.menu_item.name)}
                        </p>
                        <p className="text-[10px] uppercase mb-1">{item.menu_item.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {variant && (
                            <span className="font-bold text-sm border-2 border-black inline-block px-1.5 py-0.5 rounded-sm">
                              {variant}
                            </span>
                          )}
                          {(item as any).is_takeaway && (
                            <span className="font-bold text-xs border border-black inline-block px-1">BUNGKUS</span>
                          )}
                          {userNote && (
                            <span className="text-sm font-bold italic bg-black text-white px-1 print:bg-transparent print:text-black print:border-2 print:border-black print:not-italic" style={{ WebkitPrintColorAdjust: 'exact' }}>
                              Note: {userNote}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : currentOrder && (
          // CUSTOMER PRINT
          <div className="p-0">
            {/* Header */}
            <div className="text-center mb-2">
              <div className="flex justify-center mb-1">
                {storeInfo.image ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/storage/${storeInfo.image}`}
                    alt="Store Logo"
                    className="w-16 h-16 object-contain"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                ) : (
                  <StoreIcon className="w-6 h-6" strokeWidth={1.5} />
                )}
              </div>
              <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">
                {storeInfo.name}
              </h1>
              {storeInfo.address && (
                <p className="text-[10px] text-muted-foreground px-1 leading-tight mt-1">
                  {storeInfo.address}
                </p>
              )}
            </div>

            {/* Info */}
            <div className="text-[10px] mb-2 pb-1 border-b border-dashed border-black">
              <div className="flex justify-between mb-0.5">
                <span>#{(currentOrder as any).daily_number || currentOrder.id}</span>
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
                {currentOrder.status === 'cancelled' ? 'BATAL' : (currentOrder.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR')}
              </div>
            </div>

            {/* Items */}
            <div className="mb-2 pb-1 border-b border-dashed border-black space-y-1">
              {currentOrder.items?.map((item: any, idx: number) => {
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
        
        /* Screen Preview */
        #receipt-preview {
             font-family: 'Arial', sans-serif;
             width: 58mm;
             margin: 0 auto;
             border: 1px solid #eee;
        }
       `}</style>

      {/* Table Selection Dialog */}
      <Dialog open={showTableSelection} onOpenChange={setShowTableSelection}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Pilih Nomor Meja</DialogTitle>
            <p className="text-muted-foreground">
              Pesanan sudah dibayar. Pilih nomor meja untuk pesanan ini.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Order Summary */}
            {pendingOrderForTable && (
              <div className="bg-secondary/30 rounded-lg p-4 border">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">Pesanan #{pendingOrderForTable.daily_number}</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(pendingOrderForTable.total)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {pendingOrderForTable.customer_name || 'Pelanggan Umum'}
                </div>
              </div>
            )}

            {/* Available Tables Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-96 overflow-y-auto">
              {availableTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTableId(table.id)}
                  className={`relative border-4 rounded-xl p-4 transition-all hover:shadow-lg ${selectedTableId === table.id
                    ? 'bg-primary text-primary-foreground border-primary scale-105'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                    }`}
                >
                  <div className="text-center">
                    <div className="text-3xl font-black mb-1">{table.table_number}</div>
                    <div className="text-xs font-medium opacity-75">
                      {table.capacity} Kursi
                    </div>
                  </div>
                  {selectedTableId === table.id && (
                    <div className="absolute top-1 right-1">
                      <div className="bg-white dark:bg-black rounded-full p-1">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {availableTables.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Tidak ada meja tersedia saat ini.</p>
                <p className="text-sm mt-2">Silakan kosongkan meja terlebih dahulu atau tambah meja baru.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowTableSelection(false);
                  setSelectedTableId(null);
                  // Show receipt without table
                  setShowReceipt(true);
                  setReceiptMode('customer');
                  setTimeout(() => window.print(), 500);
                }}
                className="flex-1 btn-outline"
              >
                Lewati (Tanpa Meja)
              </Button>
              <Button
                onClick={handleAssignTable}
                disabled={!selectedTableId}
                className="flex-1 btn-primary"
              >
                Konfirmasi Meja
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout >
  );
}
