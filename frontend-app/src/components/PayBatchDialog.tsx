import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { QueueBatch } from "@/hooks/useQueueBoard";

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);

interface PayBatchDialogProps {
    batch: QueueBatch | null;
    label: string;
    dailyNumber?: number;
    customerName?: string;
    onOpenChange: (open: boolean) => void;
    /** paidBatch = batch setelah lunas, dipakai untuk mencetak nota tambahan */
    onPaid: (paidBatch: QueueBatch) => void;
}

/**
 * Pembayaran tambahan berdiri sendiri: kasir hanya menerima uang sebesar tagihan
 * tambahan itu, dengan metode yang boleh berbeda dari pesanan awal.
 */
export function PayBatchDialog({
    batch, label, dailyNumber, customerName, onOpenChange, onPaid,
}: PayBatchDialogProps) {
    const { toast } = useToast();
    const [method, setMethod] = useState<"cash" | "card" | "qris">("cash");
    const [paidAmount, setPaidAmount] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (batch) {
            setMethod("cash");
            setPaidAmount("");
        }
    }, [batch?.id]);

    const subtotal = Number(batch?.subtotal ?? 0);
    const entered = paidAmount ? parseFloat(paidAmount) : 0;
    const change = method === "cash" ? Math.max(0, entered - subtotal) : 0;
    const insufficient = method === "cash" && paidAmount !== "" && entered < subtotal;

    const handlePay = async () => {
        if (!batch) return;
        setSaving(true);
        try {
            const res = await api.post(`/order-batches/${batch.id}/pay`, {
                payment_method: method,
                // Tunai boleh dilebihkan (ada kembalian); non-tunai selalu pas.
                paid_amount: method === "cash" && paidAmount ? entered : undefined,
            });
            toast({
                title: "✅ Tambahan Dibayar",
                description: `${label} sebesar ${formatCurrency(subtotal)} lunas.`,
                className: "bg-green-600 text-white border-none",
            });
            // Item tidak ikut terkirim di response pay — bawa dari batch yang sedang dibayar
            // supaya nota tambahan bisa langsung dicetak.
            onPaid({ ...batch, ...(res.data?.batch ?? {}), items: batch.items });
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: "Gagal",
                description: error.response?.data?.message || "Pembayaran tambahan gagal",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const methodButton = (
        value: "cash" | "card" | "qris",
        icon: React.ReactNode,
        text: string,
    ) => (
        <button
            className={`p-3 rounded-xl border-2 transition-all ${
                method === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => setMethod(value)}
        >
            {icon}
            <span className="text-xs font-medium">{text}</span>
        </button>
    );

    return (
        <Dialog open={!!batch} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Bayar {label}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Pesanan #{dailyNumber} · {customerName || "Pelanggan"} — hanya tagihan tambahan ini
                    </p>
                </DialogHeader>

                <div className="py-2">
                    <p className="text-center text-3xl font-bold mb-4">{formatCurrency(subtotal)}</p>

                    <p className="text-sm text-muted-foreground mb-2">Metode Pembayaran</p>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {methodButton("cash", <Banknote className="w-5 h-5 mx-auto mb-1 text-primary" />, "Cash")}
                        {methodButton("card", <CreditCard className="w-5 h-5 mx-auto mb-1 text-primary" />, "Kartu")}
                        {methodButton("qris", <QrCode className="w-5 h-5 mx-auto mb-1 text-primary" />, "QRIS")}
                    </div>

                    {method === "cash" && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-1.5">Uang Dibayar</p>
                            <Input
                                type="number"
                                placeholder={`Kosongkan jika uang pas (${formatCurrency(subtotal)})`}
                                value={paidAmount}
                                onChange={e => setPaidAmount(e.target.value)}
                            />
                            {insufficient && (
                                <p className="text-xs text-destructive mt-1.5">
                                    Uang kurang {formatCurrency(subtotal - entered)}
                                </p>
                            )}
                            {change > 0 && (
                                <div className="mt-2 p-2 bg-green-500/10 rounded-lg flex justify-between text-sm">
                                    <span>Kembalian</span>
                                    <span className="font-bold text-green-700">{formatCurrency(change)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Batal
                    </Button>
                    <Button onClick={handlePay} disabled={saving || insufficient}>
                        {saving ? "Memproses..." : "Konfirmasi Bayar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
