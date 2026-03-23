import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import {
    Plus,
    Minus,
    Trash2,
    Search,
    X,
    Utensils,
    Coffee,
    Save,
    ShoppingBag,
    Pencil,
    AlertTriangle,
} from 'lucide-react';

interface MenuItem {
    id: number;
    name: string;
    category: string;
    price: number;
    discount_percentage?: number;
    status?: 'ready' | 'kosong' | 'pending';
    stock?: number;
    current_stock?: number;
    variants?: Array<{
        name: string;
        price: number;
        status: 'ready' | 'kosong' | 'pending';
    }>;
}

interface EditItem {
    id?: number; // existing order_item id (undefined for new items)
    menu_item_id: number;
    menu_item_name: string;
    menu_item_category: string;
    quantity: number;
    price: number; // unit price (discounted)
    note: string;
    is_takeaway: boolean;
    additional_price: number; // variant price
    variant?: string;
}

interface EditQueueOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: any;
    onSuccess: () => void;
}

const getDiscountedPrice = (item: MenuItem) => {
    const price = parseFloat(item.price as any);
    if (item.discount_percentage && item.discount_percentage > 0) {
        return price * (1 - item.discount_percentage / 100);
    }
    return price;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export function EditQueueOrderDialog({
    open,
    onOpenChange,
    order,
    onSuccess,
}: EditQueueOrderDialogProps) {
    const { toast } = useToast();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [editItems, setEditItems] = useState<EditItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showMenuPicker, setShowMenuPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [menuLoading, setMenuLoading] = useState(false);
    const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);

    // Load menu items and order items when dialog opens
    useEffect(() => {
        if (open && order) {
            fetchMenuItems();
            initializeEditItems();
        }
    }, [open, order]);

    const fetchMenuItems = async () => {
        setMenuLoading(true);
        try {
            const response = await api.get('/menu');
            setMenuItems(response.data);
        } catch (error) {
            console.error('Failed to fetch menu:', error);
        } finally {
            setMenuLoading(false);
        }
    };

    const initializeEditItems = () => {
        if (!order?.items) return;

        const items: EditItem[] = order.items.map((item: any) => {
            // Parse note to extract variant info
            let variant: string | undefined;
            let userNote = item.note || '';
            let additionalPrice = 0;

            // Check if note contains variant info like "Kuah: Bening"
            const variantMatch = userNote.match(/^Kuah:\s*([^.]+)/);
            if (variantMatch) {
                variant = variantMatch[1].trim();
                userNote = userNote.replace(/^Kuah:\s*[^.]+\.?\s*/, '').trim();
            }

            // Calculate additional price from variant (price - base menu price)
            const menuItem = item.menu_item;
            if (menuItem) {
                const basePrice = getDiscountedPrice(menuItem);
                const itemPrice = parseFloat(item.price as any);
                if (itemPrice > basePrice) {
                    additionalPrice = itemPrice - basePrice;
                }
            }

            return {
                id: item.id,
                menu_item_id: item.menu_item_id || item.menu_item?.id,
                menu_item_name: item.menu_item?.name || 'Item Dihapus',
                menu_item_category: item.menu_item?.category || '',
                quantity: item.quantity,
                price: parseFloat(item.price as any),
                note: userNote,
                is_takeaway: !!item.is_takeaway,
                additional_price: additionalPrice,
                variant: variant,
            };
        });

        setEditItems(items);
    };

    // Categories from menu items
    const categories = useMemo(() => {
        return [...new Set(menuItems.map((m) => m.category))];
    }, [menuItems]);

    // Calculate how many of each menu item is already in the edit list
    const getUsedQuantity = (menuItemId: number) => {
        return editItems
            .filter((ei) => ei.menu_item_id === menuItemId)
            .reduce((sum, ei) => sum + ei.quantity, 0);
    };

    // Get remaining available stock for a menu item
    // Uses current_stock (calculated from ingredients, same as kasir) instead of raw stock
    const getRemainingStock = (menuItem: MenuItem) => {
        const effectiveStock = menuItem.current_stock ?? menuItem.stock;
        if (effectiveStock === undefined || effectiveStock === null) return null; // No stock tracking
        // The current_stock from API already reflects orders that have been placed.
        // But items currently in editItems that are NEW (no id) haven't been deducted yet.
        // Items that already existed (have id) were already deducted from stock when originally ordered.
        const newItemsQty = editItems
            .filter((ei) => ei.menu_item_id === menuItem.id && !ei.id)
            .reduce((sum, ei) => sum + ei.quantity, 0);
        return effectiveStock - newItemsQty;
    };

    // Filtered menu items for the picker
    const filteredMenuItems = useMemo(() => {
        return menuItems
            .filter((item) => {
                const matchesSearch = item.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase());
                const matchesCategory =
                    !selectedCategory || item.category === selectedCategory;
                const isAvailable = item.status !== 'kosong';
                return matchesSearch && matchesCategory && isAvailable;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [menuItems, searchQuery, selectedCategory]);

    // Calculate total
    const total = useMemo(() => {
        return editItems.reduce((sum, item) => {
            return sum + item.price * item.quantity;
        }, 0);
    }, [editItems]);

    // Original total
    const originalTotal = order?.total || 0;
    const totalDifference = total - originalTotal;

    // Update item quantity
    const updateQuantity = (index: number, newQty: number) => {
        if (newQty <= 0) {
            removeItem(index);
            return;
        }
        setEditItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, quantity: newQty } : item))
        );
    };

    // Update item note
    const updateNote = (index: number, note: string) => {
        setEditItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, note } : item))
        );
    };

    // Remove item
    const removeItem = (index: number) => {
        setEditItems((prev) => prev.filter((_, i) => i !== index));
    };

    // Add menu item to order
    const addMenuItem = (menuItem: MenuItem) => {
        const discountedPrice = getDiscountedPrice(menuItem);

        // Check stock availability
        const remaining = getRemainingStock(menuItem);
        if (remaining !== null && remaining <= 0) {
            toast({
                title: '⚠️ Stok Habis',
                description: `${menuItem.name} tidak memiliki stok tersisa`,
                variant: 'destructive',
            });
            return;
        }

        // Check if item already exists
        const existingIdx = editItems.findIndex(
            (ei) => ei.menu_item_id === menuItem.id
        );

        if (existingIdx >= 0) {
            // Check if incrementing would exceed stock
            if (remaining !== null && editItems[existingIdx].quantity >= remaining + (editItems[existingIdx].id ? editItems[existingIdx].quantity : 0)) {
                toast({
                    title: '⚠️ Stok Tidak Cukup',
                    description: `Stok ${menuItem.name} tersisa: ${remaining}`,
                    variant: 'destructive',
                });
                return;
            }
            // Increment quantity
            updateQuantity(existingIdx, editItems[existingIdx].quantity + 1);
        } else {
            // Add new item
            const newItem: EditItem = {
                menu_item_id: menuItem.id,
                menu_item_name: menuItem.name,
                menu_item_category: menuItem.category || '',
                quantity: 1,
                price: discountedPrice,
                note: '',
                is_takeaway: false,
                additional_price: 0,
            };
            setEditItems((prev) => [...prev, newItem]);
        }

        toast({
            title: '✅ Item Ditambahkan',
            description: `${menuItem.name} ditambahkan ke pesanan`,
            className: 'bg-green-600 text-white border-none',
        });
    };

    // Replace menu item in order
    const replaceMenuItem = (index: number, newMenuItem: MenuItem) => {
        const discountedPrice = getDiscountedPrice(newMenuItem);
        setEditItems((prev) =>
            prev.map((item, i) =>
                i === index
                    ? {
                        ...item,
                        menu_item_id: newMenuItem.id,
                        menu_item_name: newMenuItem.name,
                        menu_item_category: newMenuItem.category || '',
                        price: discountedPrice,
                        additional_price: 0,
                        variant: undefined,
                    }
                    : item
            )
        );
        setReplacingIndex(null);
    };

    const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

    // Handle save
    const handleSave = async () => {
        if (editItems.length === 0) {
            toast({
                title: 'Error',
                description: 'Pesanan harus memiliki minimal 1 item',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                items: editItems.map((item) => {
                    // Reconstruct note with variant
                    let fullNote = '';
                    if (item.variant) {
                        fullNote = `Kuah: ${item.variant}`;
                    }
                    if (item.note) {
                        fullNote = fullNote ? `${fullNote}. ${item.note}` : item.note;
                    }

                    return {
                        menu_item_id: item.menu_item_id,
                        quantity: item.quantity,
                        note: fullNote || null,
                        is_takeaway: item.is_takeaway,
                        additional_price: item.additional_price || 0,
                    };
                }),
                order_type: order.order_type || 'dine_in',
                customer_name: order.customer_name,
            };

            await api.put(`/orders/${order.id}/items`, payload);

            toast({
                title: '✅ Pesanan Diperbarui',
                description: `Pesanan #${order.daily_number} berhasil diupdate. Total: ${formatCurrency(total)}`,
                className: 'bg-green-600 text-white border-none shadow-lg',
            });

            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to update order:', error);
            toast({
                title: 'Gagal Update',
                description:
                    error.response?.data?.error ||
                    error.response?.data?.message ||
                    'Gagal memperbarui pesanan',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!order) return null;

    const getCategoryIcon = (category: string) => {
        const cat = category?.toLowerCase() || '';
        if (['minuman', 'drink', 'beverage', 'drinks'].includes(cat)) {
            return <Coffee className="h-3 w-3" />;
        }
        return <Utensils className="h-3 w-3" />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Pencil className="h-5 w-5 text-primary" />
                        Edit Pesanan #{order.daily_number}
                        <Badge
                            variant={
                                order.order_type === 'takeaway' ? 'destructive' : 'secondary'
                            }
                            className="text-xs"
                        >
                            {order.order_type === 'takeaway' ? 'Dibungkus' : 'Makan Sini'}
                        </Badge>
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">
                        {order.customer_name || 'Pelanggan'} · Kasir: {order.user?.name}
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
                    {/* Current Items */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">
                                Item Pesanan ({editItems.length})
                            </h3>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-primary text-primary hover:bg-primary hover:text-white"
                                onClick={() => {
                                    setShowMenuPicker(true);
                                    setReplacingIndex(null);
                                    // Re-fetch menu items to get latest stock from kasir
                                    fetchMenuItems();
                                }}
                            >
                                <Plus className="h-3 w-3" />
                                Tambah Item
                            </Button>
                        </div>

                        {editItems.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg bg-muted/30">
                                <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                Belum ada item. Tambahkan menu di atas.
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {editItems.map((item, index) => (
                                    <div
                                        key={`${item.menu_item_id}-${index}`}
                                        className="group rounded-lg border bg-card p-2.5 hover:border-primary/30 transition-all"
                                    >
                                        <div className="flex items-start gap-2">
                                            {/* Category Icon */}
                                            <div className="mt-0.5 p-1 rounded bg-muted">
                                                {getCategoryIcon(item.menu_item_category)}
                                            </div>

                                            {/* Item Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-medium truncate">
                                                        {item.menu_item_name}
                                                    </span>
                                                    {item.variant && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] px-1 py-0 h-4"
                                                        >
                                                            {item.variant}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatCurrency(item.price)} / item
                                                </div>

                                                {/* Note */}
                                                {editingNoteIdx === index ? (
                                                    <div className="mt-1 flex gap-1">
                                                        <Input
                                                            value={item.note}
                                                            onChange={(e) =>
                                                                updateNote(index, e.target.value)
                                                            }
                                                            placeholder="Catatan item..."
                                                            className="h-6 text-xs flex-1"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') setEditingNoteIdx(null);
                                                            }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() => setEditingNoteIdx(null)}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="mt-0.5 text-[10px] text-muted-foreground hover:text-primary cursor-pointer truncate max-w-full text-left"
                                                        onClick={() => setEditingNoteIdx(index)}
                                                    >
                                                        {item.note ? (
                                                            <span className="italic">📝 {item.note}</span>
                                                        ) : (
                                                            <span className="opacity-60">
                                                                + Tambah catatan
                                                            </span>
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 w-6 p-0 rounded-full"
                                                    onClick={() =>
                                                        updateQuantity(index, item.quantity - 1)
                                                    }
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-6 text-center text-sm font-bold">
                                                    {item.quantity}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 w-6 p-0 rounded-full"
                                                    onClick={() =>
                                                        updateQuantity(index, item.quantity + 1)
                                                    }
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            {/* Subtotal */}
                                            <div className="text-right min-w-[70px]">
                                                <div className="text-sm font-semibold text-primary">
                                                    {formatCurrency(item.price * item.quantity)}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-0.5">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600"
                                                    title="Ganti menu"
                                                    onClick={() => {
                                                        setReplacingIndex(index);
                                                        setShowMenuPicker(true);
                                                        fetchMenuItems(); // Re-fetch latest stock
                                                    }}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                    title="Hapus item"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer - Totals & Actions */}
                <div className="border-t pt-3 space-y-3">
                    {/* Total Summary */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Total Sebelumnya:</span>
                            <span>{formatCurrency(originalTotal)}</span>
                        </div>
                        {totalDifference !== 0 && (
                            <div
                                className={`flex justify-between items-center text-xs font-medium ${totalDifference > 0 ? 'text-destructive' : 'text-green-600'
                                    }`}
                            >
                                <span className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Selisih:
                                </span>
                                <span>
                                    {totalDifference > 0 ? '+' : ''}
                                    {formatCurrency(totalDifference)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-base font-bold pt-1 border-t">
                            <span>Total Baru:</span>
                            <span className="text-primary text-lg">
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Batal
                        </Button>
                        <Button
                            className="flex-1 gap-1.5 bg-primary hover:bg-primary/90"
                            onClick={handleSave}
                            disabled={loading || editItems.length === 0}
                        >
                            <Save className="h-4 w-4" />
                            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </div>

                {/* Menu Picker Sheet */}
                {showMenuPicker && (
                    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center">
                        <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
                            {/* Picker Header */}
                            <div className="p-4 border-b flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-sm">
                                        {replacingIndex !== null
                                            ? `Ganti: ${editItems[replacingIndex]?.menu_item_name}`
                                            : 'Tambah Item Menu'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {replacingIndex !== null
                                            ? 'Pilih menu pengganti'
                                            : 'Pilih menu untuk ditambahkan'}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                        setShowMenuPicker(false);
                                        setReplacingIndex(null);
                                        setSearchQuery('');
                                        setSelectedCategory(null);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Search */}
                            <div className="p-3 border-b space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Cari menu..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 h-8 text-sm"
                                        autoFocus
                                    />
                                </div>

                                {/* Category Filter */}
                                <div className="flex gap-1 overflow-x-auto pb-1">
                                    <Button
                                        size="sm"
                                        variant={selectedCategory === null ? 'default' : 'ghost'}
                                        className="h-6 text-[10px] px-2 whitespace-nowrap rounded-full"
                                        onClick={() => setSelectedCategory(null)}
                                    >
                                        Semua
                                    </Button>
                                    {categories.map((cat) => (
                                        <Button
                                            key={cat}
                                            size="sm"
                                            variant={
                                                selectedCategory === cat ? 'default' : 'ghost'
                                            }
                                            className="h-6 text-[10px] px-2 whitespace-nowrap rounded-full"
                                            onClick={() => setSelectedCategory(cat)}
                                        >
                                            {cat}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Menu List */}
                            <div className="flex-1 overflow-y-auto p-2">
                                {menuLoading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Memuat menu...
                                        </p>
                                    </div>
                                ) : filteredMenuItems.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        Tidak ada menu ditemukan
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-1">
                                        {filteredMenuItems.map((menuItem) => {
                                            const discountedPrice = getDiscountedPrice(menuItem);
                                            const hasDiscount =
                                                menuItem.discount_percentage &&
                                                menuItem.discount_percentage > 0;
                                            const remainingStock = getRemainingStock(menuItem);
                                            const isOutOfStock = remainingStock !== null && remainingStock <= 0;
                                            const isLowStock = remainingStock !== null && remainingStock > 0 && remainingStock <= 5;

                                            return (
                                                <button
                                                    key={menuItem.id}
                                                    className={`flex items-center gap-3 p-2.5 rounded-lg border border-transparent transition-all text-left w-full group ${
                                                        isOutOfStock
                                                            ? 'opacity-50 cursor-not-allowed bg-muted/30'
                                                            : 'hover:bg-primary/5 hover:border-primary/20'
                                                    }`}
                                                    onClick={() => {
                                                        if (isOutOfStock) {
                                                            toast({
                                                                title: '⚠️ Stok Habis',
                                                                description: `${menuItem.name} tidak memiliki stok tersisa`,
                                                                variant: 'destructive',
                                                            });
                                                            return;
                                                        }
                                                        if (replacingIndex !== null) {
                                                            replaceMenuItem(replacingIndex, menuItem);
                                                            setShowMenuPicker(false);
                                                            setSearchQuery('');
                                                            setSelectedCategory(null);
                                                            toast({
                                                                title: '🔄 Menu Diganti',
                                                                description: `Diganti menjadi ${menuItem.name}`,
                                                                className:
                                                                    'bg-blue-600 text-white border-none',
                                                            });
                                                        } else {
                                                            addMenuItem(menuItem);
                                                        }
                                                    }}
                                                >
                                                    <div className="p-1.5 rounded bg-muted group-hover:bg-primary/10">
                                                        {getCategoryIcon(menuItem.category)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">
                                                            {menuItem.name}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            {menuItem.category}
                                                            {remainingStock !== null && (
                                                                <span className={`ml-1 font-semibold ${
                                                                    isOutOfStock
                                                                        ? 'text-destructive'
                                                                        : isLowStock
                                                                            ? 'text-orange-500'
                                                                            : 'text-muted-foreground'
                                                                }`}>
                                                                    · Stok: {remainingStock}
                                                                    {isOutOfStock && ' (Habis)'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {hasDiscount ? (
                                                            <div>
                                                                <div className="text-[10px] line-through text-muted-foreground">
                                                                    {formatCurrency(menuItem.price)}
                                                                </div>
                                                                <div className="text-sm font-semibold text-primary">
                                                                    {formatCurrency(discountedPrice)}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm font-semibold text-primary">
                                                                {formatCurrency(discountedPrice)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isOutOfStock ? (
                                                        <X className="h-4 w-4 text-destructive" />
                                                    ) : (
                                                        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
