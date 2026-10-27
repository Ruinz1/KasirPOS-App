<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mode pajak ikut di-snapshot ke pesanan, sama seperti tarifnya, supaya nota
     * lama tetap dihitung dengan cara yang sama walau setelan toko diubah.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('tax_inclusive')->default(false)->after('tax_amount');
        });

        Schema::table('order_item_batches', function (Blueprint $table) {
            $table->boolean('tax_inclusive')->default(false)->after('tax_amount');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('tax_inclusive');
        });
        Schema::table('order_item_batches', function (Blueprint $table) {
            $table->dropColumn('tax_inclusive');
        });
    }
};
