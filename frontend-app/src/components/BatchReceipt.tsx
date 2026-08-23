import { useEffect, useState } from "react";
import api from "@/lib/api";
import { storageUrl } from "@/lib/utils";
import { Store as StoreIcon } from "lucide-react";
import { QueueBatch, QueueItem } from "@/hooks/useQueueBoard";

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);

const formatItemNote = (note: string | null | undefined, menuName?: string) => {
    if (!note) return "";
    const isBakso = menuName?.toLowerCase().includes("bakso");
    return isBakso ? note : note.replace(/^(?:Kuah|Variasi):\s*/i, "");
};

export interface BatchReceiptData {
    batch: QueueBatch;
    label: string;
    dailyNumber?: number;
    customerName?: string;
    orderType?: string;
    tableNumber?: string | null;
    cashierName?: string;
}

/**
 * Nota khusus untuk satu pesanan tambahan — hanya memuat item & pembayaran
 * tambahan itu, karena uangnya diterima terpisah dari pesanan awal.
 * Dicetak lewat #receipt-print (58mm thermal), sama seperti nota kasir.
 */
export function BatchReceipt({ data }: { data: BatchReceiptData | null }) {
    const [storeInfo, setStoreInfo] = useState<{ name: string; address: string; image?: string }>({
        name: "KedaiPOS",
        address: "",
    });

    useEffect(() => {
        api.get("/store")
            .then(res =>
                setStoreInfo({
                    name: res.data.name || "KedaiPOS",
                    address: res.data.location || "",
                    image: res.data.image,
                })
            )
            .catch(() => {});
    }, []);

    if (!data) return null;

    const { batch, label, dailyNumber, customerName, orderType, tableNumber, cashierName } = data;
    const items: QueueItem[] = batch.items ?? [];
    const subtotal = Number(batch.subtotal ?? 0);
    const paid = Number(batch.paid_amount ?? 0);
    const change = Number(batch.change_amount ?? 0);

    return (
        <div id="receipt-print" className="hidden">
            <div className="p-0">
                {/* Header */}
                <div className="text-center mb-2">
                    <div className="flex justify-center mb-1">
                        {storeInfo.image ? (
                            <img
                                src={storageUrl(storeInfo.image)}
                                alt="Store Logo"
                                className="w-16 h-16 object-contain"
                                style={{ maxWidth: "100%", height: "auto" }}
                            />
                        ) : (
                            <StoreIcon className="w-6 h-6" strokeWidth={1.5} />
                        )}
                    </div>
                    <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">
                        {storeInfo.name}
                    </h1>
                    {storeInfo.address && <p className="text-[9px] leading-tight">{storeInfo.address}</p>}
                </div>

                {/* Penanda nota tambahan */}
                <div className="text-center border-y border-dashed border-black py-1 mb-2">
                    <p className="font-bold text-sm uppercase">Nota {label}</p>
                    <p className="text-[10px]">Pesanan #{dailyNumber}</p>
                </div>

                {/* Info */}
                <div className="text-[10px] mb-2 space-y-0.5">
                    <div className="flex justify-between">
                        <span>Nama</span>
                        <span className="font-semibold">{customerName || "Pelanggan"}</span>
                    </div>
                    {tableNumber && (
                        <div className="flex justify-between">
                            <span>Meja</span>
                            <span className="font-semibold">{tableNumber}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span>Tipe</span>
                        <span className="uppercase font-semibold">
                            {orderType === "dine_in" ? "Dine In" : orderType === "delivery" ? "Delivery" : "Takeaway"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Waktu</span>
                        <span>
                            {new Date(batch.paid_at || batch.created_at).toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </div>
                    {cashierName && (
                        <div className="flex justify-between">
                            <span>Kasir</span>
                            <span>{cashierName}</span>
                        </div>
                    )}
                </div>

                {/* Item tambahan */}
                <div className="border-t border-dashed border-black pt-1 mb-2 space-y-1">
                    {items.map((item, idx) => (
                        <div key={idx} className="text-[10px] leading-tight">
                            <div className="font-bold flex items-center gap-1">
                                {item.menu_item?.name || "Item"}
                                {item.is_takeaway && (
                                    <span className="text-[9px] uppercase font-normal border border-black px-0.5 rounded-sm">
                                        Bungkus
                                    </span>
                                )}
                            </div>
                            {item.note && (
                                <div className="italic text-[9px] mb-0.5">
                                    - {formatItemNote(item.note, item.menu_item?.name)}
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>
                                    {item.quantity} x {formatCurrency(Number(item.price))}
                                </span>
                                <span className="font-semibold">
                                    {formatCurrency(item.quantity * Number(item.price))}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total & pembayaran tambahan ini saja */}
                <div className="mb-2 text-[10px] space-y-0.5 border-t border-dashed border-black pt-1">
                    <div className="flex justify-between font-bold text-xs">
                        <span>TOTAL TAMBAHAN</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {batch.payment_status === "paid" && (
                        <>
                            <div className="flex justify-between">
                                <span>Dibayar ({(batch.payment_method || "").toUpperCase()})</span>
                                <span>{formatCurrency(paid)}</span>
                            </div>
                            {change > 0 && (
                                <div className="flex justify-between font-semibold">
                                    <span>Kembalian</span>
                                    <span>{formatCurrency(change)}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="text-[9px] text-center italic mb-1">
                    Nota ini hanya untuk pesanan tambahan
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] pt-1 border-t border-dashed border-black">
                    <p className="font-semibold mb-0.5">Terima Kasih</p>
                    <p className="text-[9px] leading-none">Powered by KedaiPOS</p>
                </div>
            </div>

            {/* Print Styles for 58mm Thermal Printer */}
            <style>{`
                @media print {
                    @page { size: 58mm auto; margin: 0mm; }
                    html, body { margin: 0; padding: 0; }
                    body * { visibility: hidden; height: 0; }
                    #receipt-print, #receipt-print * {
                        visibility: visible;
                        height: auto;
                        color: #000 !important;
                    }
                    #receipt-print {
                        display: block !important;
                        position: absolute;
                        left: 0; top: 0;
                        width: 58mm;
                        padding: 2mm 2mm 6mm 2mm;
                        font-family: 'Arial', sans-serif;
                        font-size: 9pt;
                        line-height: 1.25;
                    }
                    #receipt-print h1 { font-size: 12pt; margin: 0; }
                    #receipt-print img { max-width: 20mm; height: auto; margin: 0 auto; }
                }
            `}</style>
        </div>
    );
}
