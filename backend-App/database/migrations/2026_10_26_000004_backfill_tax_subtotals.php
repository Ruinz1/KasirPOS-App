<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Data lama belum mengenal pajak: pajaknya 0, jadi subtotal sama dengan total.
     * Tanpa backfill ini, nota/laporan lama akan menampilkan subtotal Rp 0.
     */
    public function up(): void
    {
        DB::table('orders')->update([
            'subtotal' => DB::raw('total'),
            'tax_percentage' => 0,
            'tax_amount' => 0,
        ]);

        DB::table('order_item_batches')->update([
            'total' => DB::raw('subtotal'),
            'tax_percentage' => 0,
            'tax_amount' => 0,
        ]);
    }

    public function down(): void
    {
        // Tidak perlu dibalik: kolomnya dibuang oleh migrasi pembuat kolom.
    }
};
