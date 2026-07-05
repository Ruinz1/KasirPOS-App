<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds variant_stock_deduction to track how much stock is deducted per variant chosen.
     * Default 1.0 = 1 unit per qty ordered.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('variant_stock_deduction', 8, 2)->nullable()->default(1.00)->after('is_addon');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('variant_stock_deduction');
        });
    }
};
