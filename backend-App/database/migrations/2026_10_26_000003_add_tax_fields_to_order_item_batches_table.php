<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Batch tambahan dibayar terpisah dari pesanan awal, jadi pajaknya ikut
     * disimpan per batch supaya tagihan tambahan juga kena pajak.
     *
     * subtotal  = nilai item batch sebelum pajak (kolom lama, maknanya dipertahankan)
     * tax_amount= pajak batch ini
     * total     = subtotal + tax_amount (yang harus dibayar)
     */
    public function up(): void
    {
        Schema::table('order_item_batches', function (Blueprint $table) {
            $table->decimal('tax_percentage', 5, 2)->default(0)->after('subtotal');
            $table->decimal('tax_amount', 12, 2)->default(0)->after('tax_percentage');
            $table->decimal('total', 12, 2)->default(0)->after('tax_amount');
        });
    }

    public function down(): void
    {
        Schema::table('order_item_batches', function (Blueprint $table) {
            $table->dropColumn(['tax_percentage', 'tax_amount', 'total']);
        });
    }
};
