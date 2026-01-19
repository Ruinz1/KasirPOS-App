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
        Schema::table('menu_items', function (Blueprint $table) {
            $table->decimal('discount_percentage', 5, 2)->default(0)->after('price');
        });
        
        Schema::table('orders', function (Blueprint $table) {
            // Already has discount and tax columns from previous implementation
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn('discount_percentage');
        });
        
        Schema::table('orders', function (Blueprint $table) {
            //
        });
    }
};
