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
        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->decimal('qris_sales', 15, 2)->default(0)->after('cash_change');
            $table->decimal('card_sales', 15, 2)->default(0)->after('qris_sales');
            $table->json('adjustments')->nullable()->after('notes_close');
        });

        Schema::table('daily_shopping', function (Blueprint $table) {
            $table->foreignId('cashier_shift_id')->nullable()->constrained('cashier_shifts')->nullOnDelete()->after('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('daily_shopping', function (Blueprint $table) {
            $table->dropForeign(['cashier_shift_id']);
            $table->dropColumn('cashier_shift_id');
        });

        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->dropColumn(['qris_sales', 'card_sales', 'adjustments']);
        });
    }
};
