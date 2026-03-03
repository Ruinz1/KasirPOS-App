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
            $table->unsignedBigInteger('parent_id')->nullable()->after('id');
            $table->decimal('portion_value', 8, 2)->default(1.0)->after('stock');
            // Change stock to decimal to support partial deductions
            $table->decimal('stock', 10, 2)->nullable()->change();
            
            $table->foreign('parent_id')->references('id')->on('menu_items')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn(['parent_id', 'portion_value']);
            // Revert stock to integer (might lose data if decimals exist, but standard rollback procedure)
            $table->integer('stock')->nullable()->change();
        });
    }
};
