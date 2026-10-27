import { ReactNode } from 'react';
import { QueueItem } from '@/hooks/useQueueBoard';
import { groupByKitchenCategoryName, kitchenColorClasses } from '@/lib/kitchenCategory';

interface Props {
    items: QueueItem[];
    /** Render satu baris item — tampilannya tetap milik halaman pemanggil. */
    renderItem: (item: QueueItem) => ReactNode;
    /** Tampilan ringkas untuk kartu antrian minuman yang lebih kecil. */
    compact?: boolean;
}

/**
 * Tampilkan item antrian dikelompokkan per kategori dapur (Bakso, Nasi Goreng, dst),
 * masing-masing dengan header berwarna, supaya tiap bagian dapur langsung mengenali
 * pesanan miliknya.
 *
 * Kalau semua item jatuh di satu kategori (atau belum ada kategori sama sekali),
 * daftar ditampilkan datar seperti sebelumnya — header grup hanya menambah
 * kebisingan kalau tidak benar-benar memisahkan apa pun.
 */
export function KitchenGroupedItems({ items, renderItem, compact = false }: Props) {
    // Papan antrian dipisah per KATEGORI, bukan per warna: dua kategori berwarna
    // sama (mis. "Mie Goreng" dan "Nasi Goreng") harus tetap tampil terpisah
    // supaya dapur jelas melihat batas tiap jenis masakan.
    const groups = groupByKitchenCategoryName(items, (item) => item.menu_item);

    // Header hanya disembunyikan kalau memang tidak ada kategori sama sekali —
    // menampilkan satu header "Lain-lain" di atas daftar tidak berguna.
    const hasAnyCategory = groups.some(group => group.categoryNames.length > 0);

    if (!hasAnyCategory) {
        return <>{items.map(renderItem)}</>;
    }

    return (
        <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
            {groups.map((group) => {
                const cls = kitchenColorClasses(group.color);
                const totalQty = group.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

                return (
                    <div key={group.key} className="rounded-lg overflow-hidden border border-border/60">
                        <div
                            className={`flex items-center gap-1.5 px-2 py-1 font-bold uppercase tracking-wide ${cls.header} ${
                                compact ? 'text-[9px]' : 'text-[10px]'
                            }`}
                        >
                            {/* Nama kategori, bukan nama warna: warnanya sudah terlihat
                                langsung dari latar header ini. */}
                            <span className="truncate">{group.name}</span>
                            <span className="ml-auto bg-white/25 px-1.5 rounded tabular-nums shrink-0">
                                {totalQty}
                            </span>
                        </div>
                        <div className={`${cls.soft} px-2 py-1.5 space-y-1`}>
                            {group.items.map(renderItem)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
