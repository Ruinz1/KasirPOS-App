/**
 * Kategori dapur (Bakso, Nasi Goreng, Mie Goreng, dst) — bebas ditambah per toko.
 *
 * Dipakai untuk mengelompokkan item di nota dapur & papan antrian supaya tiap
 * bagian dapur langsung lihat pesanan miliknya. Berbeda dari `category`
 * (Makanan/Minuman/Snack) yang dipakai sistem untuk memisah antrian makanan
 * vs minuman — jangan dicampur.
 */

export interface KitchenCategory {
    id: number;
    name: string;
    color: string;
    sort_order: number;
    menu_items_count?: number;
}

/** Warna yang boleh dipakai — harus sinkron dengan KitchenCategory::COLORS di backend. */
export const KITCHEN_CATEGORY_COLORS = [
    'orange', 'red', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'slate',
] as const;

export type KitchenCategoryColor = (typeof KITCHEN_CATEGORY_COLORS)[number];

/**
 * Kelas Tailwind per warna. Ditulis statis (bukan dirangkai `bg-${color}-500`)
 * karena Tailwind hanya menyertakan kelas yang terlihat di kode saat build.
 */
interface ColorClasses {
    /** Header strip grup di antrian — latar penuh, teks putih. */
    header: string;
    /** Badge kecil (kasir, daftar menu). */
    badge: string;
    /** Titik penanda warna. */
    dot: string;
    /** Latar lembut untuk isi grup. */
    soft: string;
}

const COLOR_CLASSES: Record<string, ColorClasses> = {
    orange: {
        header: 'bg-orange-500 text-white',
        badge: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        dot: 'bg-orange-500',
        soft: 'bg-orange-50/60 dark:bg-orange-950/20',
    },
    red: {
        header: 'bg-red-600 text-white',
        badge: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        dot: 'bg-red-600',
        soft: 'bg-red-50/60 dark:bg-red-950/20',
    },
    amber: {
        header: 'bg-amber-500 text-white',
        badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
        soft: 'bg-amber-50/60 dark:bg-amber-950/20',
    },
    green: {
        header: 'bg-green-600 text-white',
        badge: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
        dot: 'bg-green-600',
        soft: 'bg-green-50/60 dark:bg-green-950/20',
    },
    teal: {
        header: 'bg-teal-600 text-white',
        badge: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
        dot: 'bg-teal-600',
        soft: 'bg-teal-50/60 dark:bg-teal-950/20',
    },
    blue: {
        header: 'bg-blue-600 text-white',
        badge: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        dot: 'bg-blue-600',
        soft: 'bg-blue-50/60 dark:bg-blue-950/20',
    },
    indigo: {
        header: 'bg-indigo-600 text-white',
        badge: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
        dot: 'bg-indigo-600',
        soft: 'bg-indigo-50/60 dark:bg-indigo-950/20',
    },
    purple: {
        header: 'bg-purple-600 text-white',
        badge: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        dot: 'bg-purple-600',
        soft: 'bg-purple-50/60 dark:bg-purple-950/20',
    },
    pink: {
        header: 'bg-pink-600 text-white',
        badge: 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800',
        dot: 'bg-pink-600',
        soft: 'bg-pink-50/60 dark:bg-pink-950/20',
    },
    slate: {
        header: 'bg-slate-600 text-white',
        badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
        dot: 'bg-slate-600',
        soft: 'bg-slate-50/60 dark:bg-slate-900/20',
    },
};

/**
 * Nama warna dalam bahasa Indonesia — dipakai sebagai label grup di nota dapur,
 * karena pengelompokan nota mengikuti WARNA kategori, bukan nama kategorinya.
 */
const COLOR_LABELS: Record<string, string> = {
    orange: 'Oranye',
    red: 'Merah',
    amber: 'Kuning',
    green: 'Hijau',
    teal: 'Tosca',
    blue: 'Biru',
    indigo: 'Nila',
    purple: 'Ungu',
    pink: 'Merah Muda',
    slate: 'Abu-abu',
};

export function kitchenColorLabel(color?: string | null): string {
    return (color && COLOR_LABELS[color]) || COLOR_LABELS.slate;
}

/** Dipakai untuk item yang belum punya kategori dapur. */
const FALLBACK: ColorClasses = COLOR_CLASSES.slate;

export function kitchenColorClasses(color?: string | null): ColorClasses {
    return (color && COLOR_CLASSES[color]) || FALLBACK;
}

/** Label grup untuk item tanpa kategori dapur. */
export const UNGROUPED_LABEL = 'Lain-lain';

export interface KitchenGroup<T> {
    key: string;
    /** Label grup = nama warna (mis. "Merah"), karena grup dibentuk per warna. */
    name: string;
    color: string;
    sortOrder: number;
    items: T[];
    /** Nama kategori yang ikut di grup warna ini, untuk keterangan tambahan. */
    categoryNames: string[];
}

/**
 * Kelompokkan item pesanan berdasarkan WARNA kategori dapurnya.
 *
 * Pengelompokan sengaja memakai warna, bukan nama kategori: beberapa kategori
 * berbeda yang diberi warna sama (mis. "Bakso" dan "Bakso Iga" sama-sama merah)
 * akan dicetak dalam satu nota, sehingga satu bagian dapur cukup memegang satu
 * kertas walau menunya bermacam-macam.
 *
 * Urutan grup mengikuti `sort_order` kategori terkecil di dalamnya (diatur di
 * halaman Menu). Item tanpa kategori dikumpulkan ke grup "Lain-lain" yang selalu
 * diletakkan paling bawah, supaya item yang belum dikelompokkan tidak pernah
 * hilang dari nota.
 */
export function groupByKitchenCategory<T>(
    items: T[],
    getMenuItem: (item: T) => { kitchen_category?: KitchenCategory | null } | null | undefined,
): KitchenGroup<T>[] {
    const groups = new Map<string, KitchenGroup<T>>();

    items.forEach((item) => {
        const kc = getMenuItem(item)?.kitchen_category ?? null;
        const color = kc?.color ?? 'slate';
        // Kunci grup = warna. Item tanpa kategori tetap dipisah sendiri walau
        // warnanya kebetulan sama dengan warna bawaan sebuah kategori.
        const key = kc ? `color-${color}` : 'ungrouped';

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                name: kc ? kitchenColorLabel(color) : UNGROUPED_LABEL,
                color,
                // Tanpa kategori selalu paling bawah.
                sortOrder: kc ? Number(kc.sort_order ?? 0) : Number.MAX_SAFE_INTEGER,
                items: [],
                categoryNames: [],
            });
        }

        const group = groups.get(key)!;
        group.items.push(item);

        if (kc?.name && !group.categoryNames.includes(kc.name)) {
            group.categoryNames.push(kc.name);
        }
        // Grup warna tampil mengikuti kategori paling atas di dalamnya.
        if (kc) {
            group.sortOrder = Math.min(group.sortOrder, Number(kc.sort_order ?? 0));
        }
    });

    // Nama kategori diurutkan supaya keterangannya stabil, tidak berubah-ubah
    // hanya karena urutan item di keranjang berbeda.
    groups.forEach(group => group.categoryNames.sort((a, b) => a.localeCompare(b)));

    return Array.from(groups.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
}

/**
 * Header grup ditampilkan selama item memang punya kategori dapur.
 *
 * Sengaja TIDAK disembunyikan saat hanya ada satu grup: nota yang dicetak per
 * bagian (mis. hanya "Merah") tetap perlu menunjukkan kategorinya, dan satu
 * pesanan yang semua menunya sekategori tetap lebih jelas kalau diberi judul.
 * Yang disembunyikan hanya kasus tanpa kategori sama sekali, karena header
 * "Lain-lain" di atas seluruh daftar tidak menjelaskan apa pun.
 */
export function shouldShowGroups<T>(groups: KitchenGroup<T>[]): boolean {
    return groups.some(group => group.categoryNames.length > 0);
}

/**
 * Kelompokkan item per KATEGORI (bukan per warna).
 *
 * Dipakai di papan antrian: di layar, warna sudah terlihat langsung dari latar
 * header, jadi yang dibutuhkan dapur adalah pemisahan per kategori — "Mie Goreng"
 * dan "Nasi Goreng" harus tetap tampil sebagai dua blok walau warnanya sama.
 *
 * Berbeda dengan `groupByKitchenCategory` yang menggabungkan per warna; itu untuk
 * NOTA CETAK, di mana satu bagian dapur memang ingin satu kertas.
 */
export function groupByKitchenCategoryName<T>(
    items: T[],
    getMenuItem: (item: T) => { kitchen_category?: KitchenCategory | null } | null | undefined,
): KitchenGroup<T>[] {
    const groups = new Map<string, KitchenGroup<T>>();

    items.forEach((item) => {
        const kc = getMenuItem(item)?.kitchen_category ?? null;
        const key = kc ? `kc-${kc.id}` : 'ungrouped';

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                name: kc?.name ?? UNGROUPED_LABEL,
                color: kc?.color ?? 'slate',
                // Tanpa kategori selalu paling bawah.
                sortOrder: kc ? Number(kc.sort_order ?? 0) : Number.MAX_SAFE_INTEGER,
                items: [],
                categoryNames: kc?.name ? [kc.name] : [],
            });
        }

        groups.get(key)!.items.push(item);
    });

    return Array.from(groups.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
}
