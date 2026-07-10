<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            // Snapshot bahan yang benar-benar dipotong (per-unit):
            // [{ "inventory_item_id": 1, "amount": 3 }, ...]
            // Dipakai untuk mengembalikan stok saat edit/hapus pesanan tanpa salah hitung.
            $table->json('ingredient_deductions')->nullable()->after('variant_stock_deduction');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('ingredient_deductions');
        });
    }
};
