<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tables = ['users', 'inventory_items', 'menu_items', 'orders', 'capital_records'];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    // Add store_id column, nullable initially
                    $table->foreignId('store_id')->nullable()->after('id')->constrained('stores')->onDelete('cascade');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = ['users', 'inventory_items', 'menu_items', 'orders', 'capital_records'];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) {
                    // Drop foreign key first (syntax: table_column_foreign)
                    $table->dropForeign([ 'store_id' ]);
                    $table->dropColumn('store_id');
                });
            }
        }
    }
};
