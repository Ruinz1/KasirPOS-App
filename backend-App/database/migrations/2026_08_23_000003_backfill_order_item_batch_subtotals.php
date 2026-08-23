<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Batch yang terlanjur dibuat sebelum kolom subtotal ada bernilai 0, sehingga
     * tagihan tambahannya tampil Rp0. Isi ulang dari item milik batch tersebut.
     */
    public function up(): void
    {
        DB::statement("
            UPDATE order_item_batches b
            SET b.subtotal = COALESCE((
                SELECT SUM(i.price * i.quantity)
                FROM order_items i
                WHERE i.batch_id = b.id
            ), 0)
            WHERE b.subtotal = 0
        ");
    }

    public function down(): void
    {
        // Tidak dibalik: mengembalikan subtotal ke 0 justru merusak data tagihan.
    }
};
