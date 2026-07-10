<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Izinkan bahan/opsi menu tanpa terhubung ke inventory (mis. "Mie", "Bihun")
     * yang hanya untuk info dapur/antrian dan tidak memotong stok.
     */
    public function up(): void
    {
        // MODIFY langsung agar tidak mengganggu foreign key yang sudah ada.
        DB::statement('ALTER TABLE menu_ingredients MODIFY inventory_item_id BIGINT UNSIGNED NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE menu_ingredients MODIFY inventory_item_id BIGINT UNSIGNED NOT NULL');
    }
};
