import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Coffee, ShoppingBag, Banknote, CreditCard, QrCode } from 'lucide-react';

interface EditOrderDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: any;
    onSuccess: () => void;
}

export function EditOrderDetailsDialog({ open, onOpenChange, order, onSuccess }: EditOrderDetailsDialogProps) {
    const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qris'>('cash');
    const [tableId, setTableId] = useState<string>('');
    const [availableTables, setAvailableTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (order && open) {
            setOrderType(order.order_type || 'dine_in');
            setPaymentMethod(order.payment_method || 'cash');
            setTableId(order.table_id?.toString() || '');

            // Fetch available tables
            fetchAvailableTables();
        }
    }, [order, open]);

    const fetchAvailableTables = async () => {
        try {
            const response = await api.get('/tables');
            setAvailableTables(response.data);
        } catch (error) {
            console.error('Failed to fetch tables:', error);
        }
    };

    const handleSubmit = async () => {
        if (!order) return;

        setLoading(true);
        try {
            const payload: any = {
                order_type: orderType,
                payment_method: paymentMethod,
            };

            // Only include table_id for dine-in orders
            if (orderType === 'dine_in') {
                payload.table_id = tableId || null;
            } else {
                payload.table_id = null; // Remove table for takeaway
            }

            await api.put(`/orders/${order.id}/details`, payload);

            toast.success('Detail pesanan berhasil diperbarui');
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to update order details:', error);
            toast.error(error.response?.data?.message || 'Gagal memperbarui detail pesanan');
        } finally {
            setLoading(false);
        }
    };

    if (!order) return null;

    // Filter tables: show available tables + current table (if exists)
    const selectableTables = availableTables.filter(
        t => t.status === 'available' || t.id === order.table_id
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Detail Pesanan #{order.daily_number}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Order Type */}
                    <div>
                        <Label className="mb-3 block">Tipe Pesanan</Label>
                        <div className="grid grid-cols-2 gap-3">
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
                    </div>

                    {/* Table Selection - Only for Dine In */}
                    {orderType === 'dine_in' && (
                        <div>
                            <Label htmlFor="table">Nomor Meja (Opsional)</Label>
                            <Select value={tableId} onValueChange={setTableId}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Pilih meja atau kosongkan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tanpa Meja</SelectItem>
                                    {selectableTables.map((table) => (
                                        <SelectItem key={table.id} value={table.id.toString()}>
                                            Meja {table.table_number} ({table.capacity} kursi)
                                            {table.id === order.table_id && ' - Saat ini'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Payment Method */}
                    <div>
                        <Label className="mb-3 block">Metode Pembayaran</Label>
                        <div className="grid grid-cols-3 gap-3">
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
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={() => onOpenChange(false)}
                            variant="outline"
                            className="flex-1"
                            disabled={loading}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            className="flex-1"
                            disabled={loading}
                        >
                            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
