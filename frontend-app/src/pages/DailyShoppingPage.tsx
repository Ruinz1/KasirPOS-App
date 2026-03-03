import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
import { MainLayout } from "@/components/layout/MainLayout";
import {
    ShoppingCart,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Plus,
    Trash2,
    Edit2,
    XCircle,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ShoppingItem {
    id: number;
    item_name: string;
    quantity: number;
    unit: string;
    price_per_unit: number;
    total_price: number;
    status: "baru" | "habis" | "sisa" | "belum_digunakan";
    notes: string | null;
    shopping_date: string;
    user: {
        id: number;
        name: string;
    };
    created_at: string;
}

interface Statistics {
    total_shopping: number;
    total_revenue: number;
    profit: number;
    total_items: number;
    status_count: {
        baru: number;
        habis: number;
        sisa: number;
        belum_digunakan: number;
    };
}

interface FormItem {
    item_name: string;
    quantity: string;
    unit: string;
    price_per_unit: string;
    total_price: string;
    notes: string;
    inventory_item_id?: string;
}

const DailyShoppingPage = () => {
    const [items, setItems] = useState<ShoppingItem[]>([]);
    const [statistics, setStatistics] = useState<Statistics>({
        total_shopping: 0,
        total_revenue: 0,
        profit: 0,
        total_items: 0,
        status_count: { baru: 0, habis: 0, sisa: 0, belum_digunakan: 0 },
    });
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    // Form state (Array for batch input)
    const [formItems, setFormItems] = useState<FormItem[]>([
        { item_name: "", quantity: "", unit: "pcs", price_per_unit: "", total_price: "", notes: "", inventory_item_id: "" }
    ]);

    const [monthlyRecap, setMonthlyRecap] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [selectedBuyer, setSelectedBuyer] = useState<string>("");
    const [priceInputMode, setPriceInputMode] = useState<'total' | 'unit'>('total');
    const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const fetchInventory = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://localhost:8000/api/inventory?type=stock", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setInventoryItems(data);
            }
        } catch (error) {
            console.error("Error fetching inventory:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://localhost:8000/api/daily-shopping/users", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const fetchMonthlyRecap = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://localhost:8000/api/daily-shopping/monthly-recap?date=${selectedDate}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            if (response.ok) {
                const data = await response.json();
                setMonthlyRecap(data);
            }
        } catch (error) {
            console.error("Error fetching recap:", error);
        }
    };

    const fetchItems = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://localhost:8000/api/daily-shopping?date=${selectedDate}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to fetch items");

            const data = await response.json();
            setItems(data);
        } catch (error) {
            console.error("Error fetching items:", error);
            toast({
                title: "Error",
                description: "Gagal memuat data belanja",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://localhost:8000/api/daily-shopping/statistics?date=${selectedDate}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to fetch statistics");

            const data = await response.json();
            setStatistics(data);
        } catch (error) {
            console.error("Error fetching statistics:", error);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchStatistics();
        fetchMonthlyRecap();
        fetchUsers();
        fetchInventory();
    }, [selectedDate]);

    // Persistence Logic
    useEffect(() => {
        const savedItems = localStorage.getItem('dailyShoppingItems');
        const savedBuyer = localStorage.getItem('dailyShoppingBuyer');

        if (savedItems) {
            try {
                setFormItems(JSON.parse(savedItems));
            } catch (e) {
                console.error("Failed to parse saved items", e);
            }
        }
        if (savedBuyer) {
            setSelectedBuyer(savedBuyer);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('dailyShoppingItems', JSON.stringify(formItems));
    }, [formItems]);

    useEffect(() => {
        localStorage.setItem('dailyShoppingBuyer', selectedBuyer);
    }, [selectedBuyer]);

    // Batch Form Handlers
    const handleAddItemRow = () => {
        setFormItems([...formItems, { item_name: "", quantity: "", unit: "pcs", price_per_unit: "", total_price: "", notes: "", inventory_item_id: "" }]);
    };

    const handleRemoveItemRow = (index: number) => {
        if (formItems.length === 1) return; // Prevent deleting the last row
        const newItems = formItems.filter((_, i) => i !== index);
        setFormItems(newItems);
    };

    const handleItemChange = (index: number, field: keyof FormItem, value: string) => {
        const newItems = [...formItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-calculation logic
        const item = newItems[index];
        const qty = parseFloat(item.quantity);

        if (field === 'quantity' && !isNaN(qty) && qty > 0) {
            if (priceInputMode === 'total' && item.total_price) {
                const total = parseFloat(item.total_price);
                if (!isNaN(total)) {
                    newItems[index].price_per_unit = (total / qty).toFixed(2); // approximate
                }
            } else if (priceInputMode === 'unit' && item.price_per_unit) {
                const unitPrice = parseFloat(item.price_per_unit);
                if (!isNaN(unitPrice)) {
                    newItems[index].total_price = Math.round(unitPrice * qty).toString();
                }
            }
        } else if (field === 'total_price' && priceInputMode === 'total') {
            const total = parseFloat(value);
            if (!isNaN(total) && !isNaN(qty) && qty > 0) {
                newItems[index].price_per_unit = (total / qty).toFixed(2);
            }
        } else if (field === 'price_per_unit' && priceInputMode === 'unit') {
            const unitPrice = parseFloat(value);
            if (!isNaN(unitPrice) && !isNaN(qty) && qty > 0) {
                newItems[index].total_price = Math.round(unitPrice * qty).toString();
            }
        }

        // Auto-fill logic when inventory item is selected
        if (field === 'inventory_item_id' && value) {
            const selectedInv = inventoryItems.find(i => i.id.toString() === value);
            if (selectedInv) {
                if (!newItems[index].item_name) newItems[index].item_name = selectedInv.name;
                if (!newItems[index].unit || newItems[index].unit === 'pcs') newItems[index].unit = selectedInv.unit;
            }
        }

        setFormItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        const isValid = formItems.every(item => item.item_name && item.quantity && item.price_per_unit);
        if (!isValid) {
            toast({ title: "Error", description: "Mohon lengkapi semua data wajib", variant: "destructive" });
            return;
        }

        try {
            const token = localStorage.getItem("token");

            // Format items for backend
            const formattedItems = formItems.map(item => ({
                ...item,
                quantity: parseFloat(item.quantity),
                price_per_unit: parseFloat(item.price_per_unit),
                inventory_item_id: item.inventory_item_id ? parseInt(item.inventory_item_id) : null,
                // Include user_id in each item if selected, as backend might expect it there
                user_id: selectedBuyer ? parseInt(selectedBuyer) : null
            }));

            const payload: any = {
                shopping_date: selectedDate,
                items: formattedItems
            };

            if (selectedBuyer) {
                payload.user_id = selectedBuyer;
            }

            const response = await fetch("http://localhost:8000/api/daily-shopping", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Failed to add items");

            setIsDialogOpen(false);

            // SweetAlert Success
            MySwal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: `${formItems.length} item belanja berhasil disimpan.`,
                timer: 2000,
                showConfirmButton: false
            });

            // Reset form
            // Reset form and clear storage
            // Reset form and clear storage
            const defaultItems = [{ item_name: "", quantity: "", unit: "pcs", price_per_unit: "", total_price: "", notes: "", inventory_item_id: "" }];
            setFormItems(defaultItems);
            setSelectedBuyer(""); // Reset buyer

            localStorage.removeItem('dailyShoppingItems');
            localStorage.removeItem('dailyShoppingBuyer');

            fetchItems();
            fetchStatistics();
            fetchMonthlyRecap();
        } catch (error) {
            console.error("Error adding items:", error);
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Terjadi kesalahan saat menyimpan data.',
            });
        }
    };

    const handleStatusUpdate = async (id: number, status: string) => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://localhost:8000/api/daily-shopping/${id}/status`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ status }),
                }
            );

            if (!response.ok) throw new Error("Failed to update status");

            const Toast = MySwal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            });

            Toast.fire({
                icon: 'success',
                title: 'Status diperbarui'
            });

            fetchItems();
            fetchStatistics();
            fetchMonthlyRecap();
        } catch (error) {
            console.error("Error updating status:", error);
            toast({
                title: "Error",
                description: "Gagal memperbarui status",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: number) => {
        const result = await MySwal.fire({
            title: 'Yakin hapus item ini?',
            text: "Data yang dihapus tidak bisa dikembalikan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        });

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://localhost:8000/api/daily-shopping/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to delete item");

            MySwal.fire(
                'Terhapus!',
                'Item belanja telah dihapus.',
                'success'
            );

            fetchItems();
            fetchStatistics();
            fetchMonthlyRecap();
        } catch (error) {
            console.error("Error deleting item:", error);
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal menghapus item.',
            });
        }
    };

    const handleEdit = (item: ShoppingItem) => {
        setEditingItem(item);
        setIsEditOpen(true);
    };

    const handleUpdateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`http://localhost:8000/api/daily-shopping/${editingItem.id}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    item_name: editingItem.item_name,
                    quantity: editingItem.quantity,
                    unit: editingItem.unit,
                    price_per_unit: editingItem.price_per_unit,
                    notes: editingItem.notes,
                    user_id: editingItem.user?.id, // Assuming backend accepts user_id
                    shopping_date: editingItem.shopping_date // Keep existing date or update if editable
                }),
            });

            if (!response.ok) throw new Error("Failed to update item");

            MySwal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Item berhasil diperbarui.',
                timer: 1500,
                showConfirmButton: false
            });

            setIsEditOpen(false);
            setEditingItem(null);
            fetchItems();
            fetchStatistics();
            fetchMonthlyRecap();
        } catch (error) {
            console.error("Error updating item:", error);
            toast({
                title: "Error",
                description: "Gagal memperbarui item",
                variant: "destructive",
            });
        }
    };

    const handleDeleteAll = async () => {
        const result = await MySwal.fire({
            title: 'Hapus Semua Item?',
            text: "Semua data belanja hari ini akan dihapus permanen!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus Semua!',
            cancelButtonText: 'Batal'
        });

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem("token");
            // Delete items sequentially or look for a bulk delete API. 
            // Since we don't have a bulk delete, we'll delete partially or iterate.
            await Promise.all(items.map(async (item) => {
                await fetch(`http://localhost:8000/api/daily-shopping/${item.id}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
            }));

            MySwal.fire(
                'Terhapus!',
                'Semua item belanja hari ini telah dihapus.',
                'success'
            );

            fetchItems();
            fetchStatistics();
            fetchMonthlyRecap();
        } catch (error) {
            console.error("Error deleting all items:", error);
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal menghapus beberapa item.',
            });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            baru: { label: "Baru", className: "bg-blue-500" },
            habis: { label: "Habis", className: "bg-red-500" },
            sisa: { label: "Sisa", className: "bg-yellow-500" },
            belum_digunakan: { label: "Belum Digunakan", className: "bg-gray-500" },
        };

        const config = statusConfig[status as keyof typeof statusConfig];
        return (
            <Badge className={config.className}>{config.label}</Badge>
        );
    };

    const handleExport = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://localhost:8000/api/daily-shopping/export?date=${selectedDate}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to export");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `belanja_harian_${selectedDate}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            MySwal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Laporan berhasil diexport',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Export error:", error);
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal mengekspor laporan',
            });
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Memuat data...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold">Belanja Harian</h1>
                        <p className="text-muted-foreground">
                            Kelola dan pantau pengeluaran belanja harian
                        </p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-48"
                        />
                        <Button variant="outline" onClick={handleExport}>
                            <TrendingDown className="w-4 h-4 mr-2" />
                            Export Excel
                        </Button>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Tambah Belanja
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Tambah Item Belanja (Batch)</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center space-x-2">
                                            <Label>Dibeli Oleh (Opsional):</Label>
                                            <Select
                                                value={selectedBuyer || "none"}
                                                onValueChange={(val) => setSelectedBuyer(val === "none" ? "" : val)}
                                            >
                                                <SelectTrigger className="w-[220px]">
                                                    <SelectValue placeholder="Pilih Pembeli" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">— Tidak Dipilih —</SelectItem>
                                                    {users.map((u) => (
                                                        <SelectItem key={u.id} value={u.id.toString()}>
                                                            {u.name}
                                                            {u.role && (
                                                                <span className="ml-1 text-xs text-muted-foreground capitalize">({u.role})</span>
                                                            )}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="flex items-center space-x-4">
                                            <Label>Mode Input Harga:</Label>
                                            <RadioGroup
                                                defaultValue="total"
                                                value={priceInputMode}
                                                onValueChange={(v) => setPriceInputMode(v as 'total' | 'unit')}
                                                className="flex gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="total" id="mode-total" />
                                                    <Label htmlFor="mode-total" className="font-normal cursor-pointer">Harga Total</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="unit" id="mode-unit" />
                                                    <Label htmlFor="mode-unit" className="font-normal cursor-pointer">Harga Satuan</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[20%]">Link Inventori (Opsional)</TableHead>
                                                    <TableHead className="w-[20%]">Nama Barang</TableHead>
                                                    <TableHead className="w-[10%]">Jumlah</TableHead>
                                                    <TableHead className="w-[10%]">Satuan</TableHead>
                                                    <TableHead className="w-[15%]">Harga Satuan</TableHead>
                                                    <TableHead className="w-[15%]">Harga Total</TableHead>
                                                    <TableHead className="w-[15%]">Catatan</TableHead>
                                                    <TableHead className="w-[5%]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {formItems.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <Select
                                                                value={item.inventory_item_id}
                                                                onValueChange={(val) => handleItemChange(index, 'inventory_item_id', val)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Pilih..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {inventoryItems.map((inv) => (
                                                                        <SelectItem key={inv.id} value={inv.id.toString()}>
                                                                            {inv.name} ({inv.current_stock} {inv.unit})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                placeholder="Nama Barang"
                                                                value={item.item_name}
                                                                onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                                                                required
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number" step="0.01" placeholder="0"
                                                                value={item.quantity}
                                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                                required
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select
                                                                value={item.unit}
                                                                onValueChange={(val) => handleItemChange(index, 'unit', val)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="pcs">Pcs</SelectItem>
                                                                    <SelectItem value="kg">Kg</SelectItem>
                                                                    <SelectItem value="liter">Liter</SelectItem>
                                                                    <SelectItem value="pack">Pack</SelectItem>
                                                                    <SelectItem value="box">Box</SelectItem>
                                                                    <SelectItem value="ikat">Ikat</SelectItem>
                                                                    <SelectItem value="gram">Gram</SelectItem>
                                                                    <SelectItem value="ml">Ml</SelectItem>
                                                                    <SelectItem value="dus">Dus</SelectItem>
                                                                    <SelectItem value="rol">Rol</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number" step="100" placeholder="Rp"
                                                                value={item.price_per_unit}
                                                                onChange={(e) => handleItemChange(index, 'price_per_unit', e.target.value)}
                                                                required
                                                                readOnly={priceInputMode === 'total'}
                                                                className={priceInputMode === 'total' ? 'bg-muted' : ''}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number" step="100" placeholder="Rp"
                                                                value={item.total_price}
                                                                onChange={(e) => handleItemChange(index, 'total_price', e.target.value)}
                                                                required
                                                                readOnly={priceInputMode === 'unit'}
                                                                className={priceInputMode === 'unit' ? 'bg-muted' : ''}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                placeholder="Opsional"
                                                                value={item.notes}
                                                                onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {formItems.length > 1 && (
                                                                <Button
                                                                    type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-600"
                                                                    onClick={() => handleRemoveItemRow(index)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div >

                                    <div className="flex justify-between items-center">
                                        <Button type="button" variant="outline" onClick={handleAddItemRow}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Tambah Baris
                                        </Button>
                                        <div className="space-x-2">
                                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                                            <Button type="submit">Simpan Semua</Button>
                                        </div>
                                    </div>
                                </form >
                            </DialogContent >
                        </Dialog >

                        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Edit Item Belanja</DialogTitle>
                                </DialogHeader>
                                {editingItem && (
                                    <form onSubmit={handleUpdateItem} className="space-y-4">
                                        <div>
                                            <Label>Nama Barang</Label>
                                            <Input
                                                value={editingItem.item_name}
                                                onChange={(e) => setEditingItem({ ...editingItem, item_name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Jumlah</Label>
                                                <Input
                                                    type="number" step="0.01"
                                                    value={editingItem.quantity}
                                                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label>Satuan</Label>
                                                <Select
                                                    value={editingItem.unit}
                                                    onValueChange={(val) => setEditingItem({ ...editingItem, unit: val })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pcs">Pcs</SelectItem>
                                                        <SelectItem value="kg">Kg</SelectItem>
                                                        <SelectItem value="liter">Liter</SelectItem>
                                                        <SelectItem value="pack">Pack</SelectItem>
                                                        <SelectItem value="box">Box</SelectItem>
                                                        <SelectItem value="ikat">Ikat</SelectItem>
                                                        <SelectItem value="gram">Gram</SelectItem>
                                                        <SelectItem value="ml">Ml</SelectItem>
                                                        <SelectItem value="dus">Dus</SelectItem>
                                                        <SelectItem value="rol">Rol</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Harga Satuan (Rp)</Label>
                                                <Input
                                                    type="number" step="100"
                                                    value={editingItem.price_per_unit}
                                                    onChange={(e) => setEditingItem({ ...editingItem, price_per_unit: parseFloat(e.target.value) })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label>Dibeli Oleh</Label>
                                                <Select
                                                    value={editingItem.user?.id?.toString() || ""}
                                                    onValueChange={(val) => {
                                                        const selected = users.find(u => u.id.toString() === val);
                                                        setEditingItem({
                                                            ...editingItem,
                                                            user: selected
                                                                ? { id: parseInt(val), name: selected.name }
                                                                : editingItem.user
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih Pembeli" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {users.map((u) => (
                                                            <SelectItem key={u.id} value={u.id.toString()}>
                                                                {u.name}
                                                                {u.role && (
                                                                    <span className="ml-1 text-xs text-muted-foreground capitalize">({u.role})</span>
                                                                )}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Catatan</Label>
                                            <Input
                                                value={editingItem.notes || ''}
                                                onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Batal</Button>
                                            <Button type="submit">Simpan Perubahan</Button>
                                        </div>
                                    </form>
                                )}
                            </DialogContent>
                        </Dialog>
                    </div >
                </div >

                {/* Statistics Cards */}
                < div className="grid gap-4 md:grid-cols-4" >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Belanja
                            </CardTitle>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {formatCurrency(statistics.total_shopping)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {statistics.total_items} item
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pendapatan</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {formatCurrency(statistics.total_revenue)}
                            </div>
                            <p className="text-xs text-muted-foreground">Hari ini</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Keuntungan</CardTitle>
                            <DollarSign
                                className={`h-4 w-4 ${statistics.profit >= 0 ? "text-green-500" : "text-red-500"
                                    }`}
                            />
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`text-2xl font-bold ${statistics.profit >= 0 ? "text-green-600" : "text-red-600"
                                    }`}
                            >
                                {formatCurrency(statistics.profit)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {statistics.profit >= 0 ? "Untung" : "Rugi"}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Status Stok
                            </CardTitle>
                            <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span>Habis:</span>
                                    <span className="font-bold">
                                        {statistics.status_count.habis}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Sisa:</span>
                                    <span className="font-bold">
                                        {statistics.status_count.sisa}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div >

                {/* Items List */}
                < Card >
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Daftar Belanja Hari Ini</CardTitle>
                        {items.length > 0 && (
                            <Button variant="destructive" size="sm" onClick={handleDeleteAll}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Hapus Semua
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="text-center py-12">
                                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                    Belum ada data belanja hari ini
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {items.map((item) => (
                                    <Card key={item.id} className="border-2">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="font-semibold text-lg">
                                                            {item.item_name}
                                                        </h3>
                                                        {getStatusBadge(item.status)}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                                        <div>
                                                            Jumlah: {item.quantity} {item.unit}
                                                        </div>
                                                        <div>
                                                            Harga/unit: {formatCurrency(item.price_per_unit)}
                                                        </div>
                                                        <div className="font-bold text-foreground">
                                                            Total: {formatCurrency(item.total_price)}
                                                        </div>
                                                        <div>Oleh: {item.user.name}</div>
                                                    </div>
                                                    {item.notes && (
                                                        <p className="text-sm text-muted-foreground mt-2 italic">
                                                            {item.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEdit(item)}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                    <Select
                                                        value={item.status}
                                                        onValueChange={(value) =>
                                                            handleStatusUpdate(item.id, value)
                                                        }
                                                    >
                                                        <SelectTrigger className="w-40">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="baru">Baru</SelectItem>
                                                            <SelectItem value="habis">Habis</SelectItem>
                                                            <SelectItem value="sisa">Sisa</SelectItem>
                                                            <SelectItem value="belum_digunakan">
                                                                Belum Digunakan
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card >

                {/* Monthly Recap */}
                < Card >
                    <CardHeader>
                        <CardTitle>Rekapan Belanja Bulan Ini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Jumlah Item</TableHead>
                                    <TableHead>Detail Item</TableHead>
                                    <TableHead className="text-right">Total Belanja</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyRecap.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                            Belum ada data belanja bulan ini
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    monthlyRecap.map((day, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium align-top">
                                                {new Date(day.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </TableCell>
                                            <TableCell className="align-top">{day.total_items} Item</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 text-sm">
                                                    {day.items_summary.map((item: any, i: number) => (
                                                        <div key={i} className="flex justify-between border-b pb-1 last:border-0 last:pb-0">
                                                            <span>{item.name}</span>
                                                            <div className="flex gap-2">
                                                                <span className="text-muted-foreground text-xs">({item.buyer})</span>
                                                                <span className="font-semibold">{formatCurrency(item.total)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold align-top text-red-600">
                                                {formatCurrency(day.total_amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card >
            </div >
        </MainLayout >
    );
};

export default DailyShoppingPage;
