/**
 * Papan antrian: satu Order bisa tampil sebagai BEBERAPA kartu — kartu pesanan awal
 * plus satu kartu per batch tambahan (tiap klik "Tambah" di kasir). Tiap kartu punya
 * status selesai/tahan sendiri, sementara nota/pembayaran tetap satu order.
 */

export const DRINK_CATEGORIES = ["minuman", "drink", "beverage", "drinks"];

export interface QueueItem {
    id: number;
    menu_item_id: number;
    quantity: number;
    price: number;
    note: string | null;
    is_takeaway?: boolean;
    is_addon?: boolean;
    batch_id?: number | null;
    menu_item: {
        id: number;
        name: string;
        price: number;
        category?: string;
    } | null;
    created_at?: string;
}

export interface QueueBatch {
    id: number;
    order_id: number;
    batch_number: number;
    /** Tagihan tambahan dibayar terpisah — bukan split bill dari pesanan awal */
    payment_method: "cash" | "card" | "qris" | null;
    payment_status: "paid" | "pending";
    subtotal: number | string;
    paid_amount: number | string | null;
    change_amount: number | string | null;
    paid_at: string | null;
    queue_status: "pending" | "in_progress" | "completed" | "hold";
    drink_queue_status: "pending" | "completed" | "hold";
    queue_completed_at: string | null;
    hold_reason: string | null;
    drink_hold_reason: string | null;
    created_at: string;
    items?: QueueItem[];
}

export interface QueueOrderBase {
    id: number;
    customer_name: string;
    daily_number: number;
    queue_status: "pending" | "in_progress" | "completed" | "hold";
    drink_queue_status: "pending" | "completed" | "hold";
    notes: string | null;
    created_at: string;
    items: QueueItem[];
    user: { id: number; name: string };
    queue_completed_at: string | null;
    hold_reason?: string | null;
    drink_hold_reason?: string | null;
    batches?: QueueBatch[];
    table?: { id: number; table_number: string; capacity: number } | null;
    order_type?: string;
}

/** legacy = order lama tanpa sistem batch (semua item dalam satu kartu) */
export type QueueCardKind = "legacy" | "primary" | "batch";

export interface QueueCard<T extends QueueOrderBase = QueueOrderBase> {
    kind: QueueCardKind;
    cardKey: string;
    order: T;
    batch: QueueBatch | null;
    items: QueueItem[];
    queue_status: "pending" | "in_progress" | "completed" | "hold";
    drink_queue_status: "pending" | "completed" | "hold";
    queue_completed_at: string | null;
    hold_reason: string | null;
    drink_hold_reason: string | null;
    cardCreatedAt: string;
    label: string;
    batchNumber: number;
}

export const isDrinkItem = (item: QueueItem) =>
    DRINK_CATEGORIES.includes((item.menu_item?.category || "").toLowerCase());

export const isFoodItem = (item: QueueItem) => !isDrinkItem(item);

/** Order lama yang sudah selesai lalu dapat tambahan (sebelum sistem batch ada) */
export const isOrderReactivated = (order: QueueOrderBase) =>
    !!(order.queue_completed_at && order.queue_status !== "completed");

const legacyDisplayItems = (order: QueueOrderBase): QueueItem[] => {
    if (isOrderReactivated(order)) {
        return order.items.filter(i => {
            if (!i.is_addon) return false;
            const cat = (i.menu_item?.category || "").toLowerCase();
            return ["makanan", "minuman"].includes(cat);
        });
    }
    return [...order.items].sort((a, b) => a.id - b.id);
};

/** Pecah daftar order menjadi daftar kartu (pesanan awal + tiap batch tambahan) */
export function flattenOrdersToCards<T extends QueueOrderBase>(orders: T[]): QueueCard<T>[] {
    const cards: QueueCard<T>[] = [];

    for (const order of orders) {
        const batches = order.batches ?? [];

        if (batches.length === 0) {
            cards.push({
                kind: "legacy",
                cardKey: `order-${order.id}`,
                order,
                batch: null,
                items: legacyDisplayItems(order),
                queue_status: order.queue_status,
                drink_queue_status: order.drink_queue_status,
                queue_completed_at: order.queue_completed_at,
                hold_reason: order.hold_reason ?? null,
                drink_hold_reason: order.drink_hold_reason ?? null,
                cardCreatedAt: order.created_at,
                label: "Pesanan Awal",
                batchNumber: 0,
            });
            continue;
        }

        const primaryItems = order.items
            .filter(i => !i.batch_id)
            .sort((a, b) => a.id - b.id);

        if (primaryItems.length > 0) {
            cards.push({
                kind: "primary",
                cardKey: `order-${order.id}`,
                order,
                batch: null,
                items: primaryItems,
                queue_status: order.queue_status,
                drink_queue_status: order.drink_queue_status,
                queue_completed_at: order.queue_completed_at,
                hold_reason: order.hold_reason ?? null,
                drink_hold_reason: order.drink_hold_reason ?? null,
                cardCreatedAt: order.created_at,
                label: "Pesanan Awal",
                batchNumber: 0,
            });
        }

        for (const batch of [...batches].sort((a, b) => a.batch_number - b.batch_number)) {
            const items = (batch.items ?? order.items.filter(i => i.batch_id === batch.id))
                .slice()
                .sort((a, b) => a.id - b.id);
            if (items.length === 0) continue;

            cards.push({
                kind: "batch",
                cardKey: `batch-${batch.id}`,
                order,
                batch,
                items,
                queue_status: batch.queue_status,
                drink_queue_status: batch.drink_queue_status,
                queue_completed_at: batch.queue_completed_at,
                hold_reason: batch.hold_reason,
                drink_hold_reason: batch.drink_hold_reason,
                cardCreatedAt: batch.created_at || order.created_at,
                label: `Tambahan ${batch.batch_number}`,
                batchNumber: batch.batch_number,
            });
        }
    }

    return cards;
}

/** Kartu disembunyikan jika semua section yang dimilikinya sudah selesai */
export function shouldHideCard(card: QueueCard<any>): boolean {
    const hasFood = card.items.some(isFoodItem);
    const hasDrink = card.items.some(isDrinkItem);
    const foodDone = card.queue_status === "completed";
    const drinkDone = card.drink_queue_status === "completed";

    if (hasFood && hasDrink) return foodDone && drinkDone;
    if (hasFood) return foodDone;
    if (hasDrink) return drinkDone;
    return foodDone;
}

/**
 * Kartu dari order yang sama dikelompokkan berdekatan (FIFO antar-order),
 * di dalam grup diurutkan nomor batch.
 */
export function sortCardsGrouped<T extends QueueOrderBase>(cards: QueueCard<T>[]): QueueCard<T>[] {
    return [...cards].sort((a, b) => {
        if (a.order.id !== b.order.id) {
            const timeDiff =
                new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime();
            return timeDiff || a.order.id - b.order.id;
        }
        return a.batchNumber - b.batchNumber;
    });
}

/** Endpoint status yang sesuai untuk kartu ini (order-level vs batch-level) */
export const cardStatusEndpoint = (card: QueueCard<any>, type: "food" | "drink") => {
    const suffix = type === "food" ? "status" : "drink-status";
    return card.kind === "batch"
        ? `/queue/batch/${card.batch!.id}/${suffix}`
        : `/queue/${card.order.id}/${suffix}`;
};
