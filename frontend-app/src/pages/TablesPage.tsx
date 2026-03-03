import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';
import Swal from 'sweetalert2';

interface Table {
    id: number;
    table_number: string;
    status: 'available' | 'occupied' | 'reserved';
    capacity: number;
    notes?: string;
    current_order_id?: number;
    current_order?: {
        id: number;
        daily_number: number;
        customer_name: string;
        total: number;
        payment_status: string;
        queue_status: string;
        items: Array<{
            menu_item: {
                name: string;
            };
            quantity: number;
        }>;
    };
}

export default function TablesPage() {
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingTable, setEditingTable] = useState<Table | null>(null);
    const [formData, setFormData] = useState({
        table_number: '',
        capacity: 4,
        notes: '',
    });

    useEffect(() => {
        fetchTables();
        // Auto refresh every 10 seconds
        const interval = setInterval(fetchTables, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchTables = async () => {
        try {
            const response = await api.get('/tables');
            setTables(response.data);
        } catch (error) {
            console.error('Failed to fetch tables:', error);
            toast.error('Gagal memuat data meja');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingTable) {
                await api.put(`/tables/${editingTable.id}`, formData);
                toast.success('Meja berhasil diupdate');
            } else {
                await api.post('/tables', formData);
                toast.success('Meja berhasil ditambahkan');
            }

            setShowDialog(false);
            resetForm();
            fetchTables();
        } catch (error: any) {
            console.error('Failed to save table:', error);
            toast.error(error.response?.data?.message || 'Gagal menyimpan meja');
        }
    };

    const handleEdit = (table: Table) => {
        setEditingTable(table);
        setFormData({
            table_number: table.table_number,
            capacity: table.capacity,
            notes: table.notes || '',
        });
        setShowDialog(true);
    };

    const handleDelete = async (table: Table) => {
        const result = await Swal.fire({
            title: 'Hapus Meja?',
            text: `Apakah Anda yakin ingin menghapus meja ${table.table_number}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            buttonsStyling: false,
            customClass: {
                popup: 'rounded-xl border border-border bg-card text-card-foreground shadow-lg',
                title: 'text-xl font-bold text-foreground',
                confirmButton: 'btn-destructive mx-1',
                cancelButton: 'btn-outline mx-1',
            },
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/tables/${table.id}`);
                toast.success('Meja berhasil dihapus');
                fetchTables();
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Gagal menghapus meja');
            }
        }
    };

    const handleReleaseTable = async (table: Table) => {
        const result = await Swal.fire({
            title: 'Kosongkan Meja?',
            text: `Apakah Anda yakin ingin mengosongkan meja ${table.table_number}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Kosongkan',
            cancelButtonText: 'Batal',
            buttonsStyling: false,
            customClass: {
                popup: 'rounded-xl border border-border bg-card text-card-foreground shadow-lg',
                title: 'text-xl font-bold text-foreground',
                confirmButton: 'btn-primary mx-1',
                cancelButton: 'btn-outline mx-1',
            },
        });

        if (result.isConfirmed) {
            try {
                await api.post(`/tables/${table.id}/release`);
                toast.success('Meja berhasil dikosongkan');
                fetchTables();
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Gagal mengosongkan meja');
            }
        }
    };

    const handleMarkServed = async (table: Table) => {
        try {
            await api.post(`/tables/${table.id}/mark-served`);
            toast.success('Pesanan ditandai sudah disajikan');
            fetchTables();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal update status');
        }
    };

    const resetForm = () => {
        setFormData({
            table_number: '',
            capacity: 4,
            notes: '',
        });
        setEditingTable(null);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available':
                return 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300';
            case 'occupied':
                return 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300';
            case 'reserved':
                return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-300';
            default:
                return 'bg-gray-100 dark:bg-gray-800 border-gray-500';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'available':
                return 'Tersedia';
            case 'occupied':
                return 'Terisi';
            case 'reserved':
                return 'Dipesan';
            default:
                return status;
        }
    };

    const getQueueStatusBadge = (queueStatus: string) => {
        switch (queueStatus) {
            case 'pending':
                return <span className="text-xs px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">Menunggu</span>;
            case 'in_progress':
                return <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Diproses</span>;
            case 'completed':
                return <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Selesai</span>;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Manajemen Meja</h1>
                        <p className="text-muted-foreground mt-1">Kelola nomor meja dan status ketersediaan</p>
                    </div>
                    <Button
                        onClick={() => {
                            resetForm();
                            setShowDialog(true);
                        }}
                        className="btn-primary"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Tambah Meja
                    </Button>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Tersedia</p>
                                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                                    {tables.filter(t => t.status === 'available').length}
                                </p>
                            </div>
                            <CheckCircle className="w-12 h-12 text-green-500" />
                        </div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Terisi</p>
                                <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                                    {tables.filter(t => t.status === 'occupied').length}
                                </p>
                            </div>
                            <XCircle className="w-12 h-12 text-red-500" />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Meja</p>
                                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                                    {tables.length}
                                </p>
                            </div>
                            <Users className="w-12 h-12 text-blue-500" />
                        </div>
                    </div>
                </div>

                {/* Tables Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {tables.map((table) => (
                        <div
                            key={table.id}
                            className={`relative border-4 rounded-2xl p-6 transition-all hover:shadow-xl ${getStatusColor(table.status)}`}
                        >
                            {/* Table Number */}
                            <div className="text-center mb-4">
                                <div className="text-5xl font-black mb-2">{table.table_number}</div>
                                <div className="text-sm font-bold uppercase tracking-wider">
                                    {getStatusText(table.status)}
                                </div>
                            </div>

                            {/* Capacity */}
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <Users className="w-4 h-4" />
                                <span className="text-sm font-medium">{table.capacity} Kursi</span>
                            </div>

                            {/* Order Info (if occupied) */}
                            {table.status === 'occupied' && table.current_order && (
                                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mb-3 text-xs space-y-1">
                                    <div className="font-bold">Pesanan #{table.current_order.daily_number}</div>
                                    <div className="text-xs opacity-75">{table.current_order.customer_name || 'Pelanggan Umum'}</div>
                                    <div className="font-bold text-sm">{formatCurrency(table.current_order.total)}</div>
                                    <div className="flex items-center gap-1">
                                        {getQueueStatusBadge(table.current_order.queue_status)}
                                    </div>
                                    {table.current_order.items && table.current_order.items.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-current/20">
                                            <div className="font-semibold mb-1">Items:</div>
                                            {table.current_order.items.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="text-xs opacity-75">
                                                    {item.quantity}x {item.menu_item?.name || 'Item'}
                                                </div>
                                            ))}
                                            {table.current_order.items.length > 3 && (
                                                <div className="text-xs opacity-75">+{table.current_order.items.length - 3} lainnya</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                {table.status === 'occupied' && (
                                    <>
                                        {table.current_order?.queue_status !== 'completed' && (
                                            <button
                                                onClick={() => handleMarkServed(table)}
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs py-2 px-3 rounded-lg font-medium transition-colors"
                                                title="Tandai Sudah Disajikan"
                                            >
                                                <CheckCircle className="w-4 h-4 mx-auto" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleReleaseTable(table)}
                                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 px-3 rounded-lg font-medium transition-colors"
                                            title="Kosongkan Meja"
                                        >
                                            Kosongkan
                                        </button>
                                    </>
                                )}

                                {table.status === 'available' && (
                                    <>
                                        <button
                                            onClick={() => handleEdit(table)}
                                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Edit className="w-3 h-3" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(table)}
                                            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Hapus
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Notes */}
                            {table.notes && (
                                <div className="mt-3 text-xs opacity-75 italic">
                                    {table.notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {tables.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Belum ada meja. Tambahkan meja pertama Anda!</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingTable ? 'Edit Meja' : 'Tambah Meja Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Nomor Meja</label>
                            <Input
                                type="text"
                                value={formData.table_number}
                                onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                                placeholder="Contoh: 1, A1, VIP-1"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Kapasitas (Kursi)</label>
                            <Input
                                type="number"
                                min="1"
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Catatan (Opsional)</label>
                            <Input
                                type="text"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Contoh: Dekat jendela, VIP area"
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button
                                type="button"
                                onClick={() => {
                                    setShowDialog(false);
                                    resetForm();
                                }}
                                className="flex-1 btn-outline"
                            >
                                Batal
                            </Button>
                            <Button type="submit" className="flex-1 btn-primary">
                                {editingTable ? 'Update' : 'Tambah'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
