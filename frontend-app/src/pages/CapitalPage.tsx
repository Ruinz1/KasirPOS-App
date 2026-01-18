import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { formatCurrency } from '@/utils/calculations';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Package,
    Users,
    ShoppingBag,
    Plus,
    Edit2,
    Trash2,
    Building2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CapitalRecord {
    id: number;
    amount: number;
    date: string;
    description: string;
    user: {
        name: string;
    };
    store?: {
        name: string;
    };
}

interface BusinessAnalysis {
    initial_capital: number;
    current_assets: {
        stock_value: number;
        equipment_value: number;
        total: number;
    };
    revenue: {
        total_sales: number;
    };
    expenses: {
        cogs: number;
        salaries: number;
        damaged_equipment: number;  // NEW: Damaged equipment as loss
        total: number;
    };
    profit_loss: {
        net_profit: number;
        status: string;
        roi_percentage: number;
    };
}

interface Store {
    id: number;
    name: string;
    location: string;
}

export default function CapitalPage() {
    const { user, isAdmin, loading: authLoading, hasPermission } = useAuth();
    const [records, setRecords] = useState<any[]>([]);
    const [analysis, setAnalysis] = useState<any>(null);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        store_id: user?.store_id || null,
    });

    useEffect(() => {
        if (hasPermission('manage_capital')) {
            if (isAdmin()) {
                fetchStores();
            } else {
                // Owner: auto-set to their store
                setSelectedStoreId(user?.store_id || null);
            }
        } else if (!authLoading) {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, authLoading]);

    useEffect(() => {
        if (selectedStoreId !== null && hasPermission('manage_capital')) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStoreId]);

    const fetchStores = async () => {
        try {
            const response = await api.get('/stores-management');
            const storesList = response.data.data || [];
            setStores(storesList);
            // Auto-select first store for admin
            if (storesList.length > 0) {
                setSelectedStoreId(storesList[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch stores:', error);
            toast.error('Gagal memuat daftar toko');
        }
    };

    const fetchData = async () => {
        if (!selectedStoreId) return;

        try {
            setLoading(true);
            const params = isAdmin() ? { store_id: selectedStoreId } : {};

            const [recordsRes, analysisRes] = await Promise.all([
                api.get('/capital', { params }),
                api.get('/capital/calculate/breakeven', { params }),
            ]);
            setRecords(recordsRes.data);
            setAnalysis(analysisRes.data);
        } catch (error) {
            console.error('Failed to fetch capital data:', error);
            toast.error('Gagal memuat data modal');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const payload: any = {
                amount: parseFloat(formData.amount),
                date: formData.date,
                description: formData.description,
            };

            // Admin can select store, Owner uses their own
            if (isAdmin()) {
                payload.store_id = formData.store_id;
            } else {
                payload.store_id = user?.store_id;
            }

            if (editingRecord) {
                await api.put(`/capital/${editingRecord.id}`, payload);
                toast.success('Modal berhasil diupdate');
            } else {
                await api.post('/capital', payload);
                toast.success('Modal berhasil ditambahkan');
            }

            resetForm();
            fetchData();
        } catch (error: any) {
            console.error('Failed to save capital:', error);
            toast.error(error.response?.data?.message || 'Gagal menyimpan modal');
        }
    };

    const handleEdit = (record: any) => {
        setFormData({
            amount: record.amount.toString(),
            date: record.date,
            description: record.description,
            store_id: record.store_id || user?.store_id,
        });
        setEditingRecord(record);
        setIsAddDialogOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Yakin ingin menghapus catatan modal ini?')) return;

        try {
            await api.delete(`/capital/${id}`);
            toast.success('Modal berhasil dihapus');
            fetchData();
        } catch (error: any) {
            console.error('Failed to delete capital:', error);
            toast.error(error.response?.data?.message || 'Gagal menghapus modal');
        }
    };

    const resetForm = () => {
        setFormData({
            amount: '',
            date: new Date().toISOString().split('T')[0],
            description: '',
            store_id: isAdmin() ? (stores[0]?.id || null) : (user?.store_id || null),
        });
        setEditingRecord(null);
        setIsAddDialogOpen(false);
    };

    if (!hasPermission('manage_capital')) {
        return (
            <MainLayout>
                <div className="p-8 text-center text-muted-foreground">
                    Anda tidak memiliki akses ke halaman ini.
                </div>
            </MainLayout>
        );
    }

    const currentStore = isAdmin()
        ? stores.find(s => s.id === selectedStoreId)
        : { id: user?.store_id, name: 'Toko Saya' };

    return (
        <MainLayout>
            <div className="p-8 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-display font-bold">Modal & Analisis Bisnis</h1>
                        <p className="text-muted-foreground mt-1">
                            Kelola modal usaha dan pantau kesehatan bisnis
                        </p>
                    </div>

                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => resetForm()}>
                                <Plus className="w-4 h-4 mr-2" />
                                Catat Modal
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingRecord ? 'Edit Modal Usaha' : 'Catat Modal Usaha'}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Store Selection - Only for Admin */}
                                {isAdmin() && (
                                    <div className="space-y-2">
                                        <Label>Toko *</Label>
                                        <Select
                                            value={formData.store_id?.toString() || ''}
                                            onValueChange={(val) => setFormData({ ...formData, store_id: parseInt(val) })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih toko" />
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

                                <div className="space-y-2">
                                    <Label>Jumlah Modal (Rp) *</Label>
                                    <Input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="1000000"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Tanggal</Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Keterangan</Label>
                                    <Input
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Modal awal usaha"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={resetForm}>Batal</Button>
                                    <Button onClick={handleSubmit}>
                                        {editingRecord ? 'Update' : 'Simpan'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Store Selector for Admin */}
                {isAdmin() && stores.length > 0 && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <Building2 className="w-5 h-5 text-muted-foreground" />
                                <div className="flex-1">
                                    <Label>Pilih Toko untuk Melihat Status Bisnis</Label>
                                    <Select
                                        value={selectedStoreId?.toString() || ''}
                                        onValueChange={(val) => setSelectedStoreId(parseInt(val))}
                                    >
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Pilih toko" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stores.map(store => (
                                                <SelectItem key={store.id} value={store.id.toString()}>
                                                    {store.name} - {store.location || 'Lokasi tidak diset'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">Loading...</div>
                ) : !selectedStoreId ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Pilih toko untuk melihat data
                    </div>
                ) : (
                    <>
                        {/* Business Status Card */}
                        {analysis && (
                            <Card className={`border-2 ${analysis.profit_loss?.status === 'profit'
                                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                                : 'border-red-500 bg-red-50 dark:bg-red-950'
                                }`}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>Status Bisnis</span>
                                        <Badge variant={analysis.profit_loss?.status === 'profit' ? 'default' : 'destructive'}>
                                            {analysis.profit_loss?.status === 'profit' ? 'Untung' : 'Rugi'}
                                        </Badge>
                                    </CardTitle>
                                    {currentStore && (
                                        <p className="text-sm text-muted-foreground">
                                            {currentStore.name}
                                        </p>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center py-4">
                                        <div className="text-sm text-muted-foreground mb-2">ROI</div>
                                        <div className={`text-4xl font-bold ${analysis.profit_loss?.status === 'profit' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {analysis.profit_loss?.roi_percentage?.toFixed(1) || 0}%
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Stats Grid */}
                        {analysis && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Modal Awal
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-blue-500" />
                                            <span className="text-2xl font-bold">
                                                {formatCurrency(analysis.initial_capital || 0)}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Aset Saat Ini
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-orange-500" />
                                            <span className="text-2xl font-bold">
                                                {formatCurrency(analysis.current_assets?.total || 0)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-2">
                                            Stock: {formatCurrency(analysis.current_assets?.stock_value || 0)} |
                                            Alat: {formatCurrency(analysis.current_assets?.equipment_value || 0)}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total Pendapatan
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2">
                                            <ShoppingBag className="w-4 h-4 text-green-500" />
                                            <span className="text-2xl font-bold">
                                                {formatCurrency(analysis.revenue?.total_sales || 0)}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total Pengeluaran
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-red-500" />
                                            <span className="text-2xl font-bold">
                                                {formatCurrency(analysis.expenses?.total || 0)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-2">
                                            HPP: {formatCurrency(analysis.expenses?.cogs || 0)} |
                                            Gaji: {formatCurrency(analysis.expenses?.salaries || 0)}
                                            {(analysis.expenses?.damaged_equipment || 0) > 0 && (
                                                <> | Alat Rusak: {formatCurrency(analysis.expenses?.damaged_equipment || 0)}</>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Profit/Loss Summary */}
                        {analysis && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Laba/Rugi Bersih</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center py-6">
                                        <div className="text-sm text-muted-foreground mb-2">
                                            Formula: (Aset + Pendapatan) - (Modal Awal + Pengeluaran)
                                        </div>
                                        <div className={`text-5xl font-bold ${(analysis.profit_loss?.net_profit || 0) >= 0
                                            ? 'text-green-600'
                                            : 'text-red-600'
                                            }`}>
                                            {(analysis.profit_loss?.net_profit || 0) >= 0 ? '' : '-'}
                                            {formatCurrency(Math.abs(analysis.profit_loss?.net_profit || 0))}
                                        </div>
                                        <div className="mt-6 space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Aset Saat Ini</span>
                                                <span className="font-medium text-blue-600">
                                                    +Rp {(analysis.current_assets?.total || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Total Pendapatan</span>
                                                <span className="font-medium text-green-600">
                                                    +Rp {(analysis.revenue?.total_sales || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Total Pengeluaran</span>
                                                <span className="font-medium text-red-600">
                                                    -Rp {(analysis.expenses?.total || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs pt-2 border-t">
                                                <span className="text-muted-foreground">  • HPP (Cost of Goods)</span>
                                                <span>Rp {(analysis.expenses?.cogs || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">  • Gaji Karyawan</span>
                                                <span>Rp {(analysis.expenses?.salaries || 0).toLocaleString()}</span>
                                            </div>
                                            {(analysis.expenses?.damaged_equipment || 0) > 0 && (
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">  • Alat Rusak</span>
                                                    <span className="text-red-600">Rp {(analysis.expenses?.damaged_equipment || 0).toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="text-muted-foreground">Modal Awal</span>
                                                <span className="font-medium text-orange-600">
                                                    -Rp {(analysis.initial_capital || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between font-bold text-base pt-3 border-t-2 border-foreground/20">
                                                <span>Laba/Rugi Bersih:</span>
                                                <span className={
                                                    (analysis.profit_loss?.net_profit || 0) >= 0
                                                        ? 'text-green-600'
                                                        : 'text-red-600'
                                                }>
                                                    {(analysis.profit_loss?.net_profit || 0) >= 0 ? '+' : '-'}
                                                    Rp {Math.abs(analysis.profit_loss?.net_profit || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Capital Records Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Riwayat Modal</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="border-b bg-muted/50">
                                            <tr>
                                                <th className="text-left p-4 font-medium">Tanggal</th>
                                                <th className="text-left p-4 font-medium">Jumlah</th>
                                                <th className="text-left p-4 font-medium">Keterangan</th>
                                                <th className="text-left p-4 font-medium">Dicatat Oleh</th>
                                                <th className="text-right p-4 font-medium">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                                                        Belum ada catatan modal
                                                    </td>
                                                </tr>
                                            ) : (
                                                records.map((record) => (
                                                    <tr key={record.id} className="border-b hover:bg-muted/50">
                                                        <td className="p-4">
                                                            {new Date(record.date).toLocaleDateString('id-ID')}
                                                        </td>
                                                        <td className="p-4 font-medium text-green-600">
                                                            {formatCurrency(record.amount)}
                                                        </td>
                                                        <td className="p-4 text-muted-foreground">
                                                            {record.description || '-'}
                                                        </td>
                                                        <td className="p-4 text-sm">
                                                            {record.user?.name || '-'}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleEdit(record)}
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDelete(record.id)}
                                                                >
                                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </MainLayout>
    );
}
