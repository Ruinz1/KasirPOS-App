<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pembayaran tambahan berdiri sendiri (bukan split bill dari tagihan awal):
     * tiap batch punya metode & jumlah bayarnya sendiri, sehingga satu order bisa
     * punya banyak pembayaran dengan metode berbeda tanpa dibatasi 2 slot di orders.
     */
    public function up(): void
    {
        Schema::table('order_item_batches', function (Blueprint $table) {
            $table->enum('payment_method', ['cash', 'card', 'qris'])->nullable()->after('batch_number');
            $table->enum('payment_status', ['paid', 'pending'])->default('pending')->after('payment_method');
            $table->decimal('subtotal', 12, 2)->default(0)->after('payment_status');
            $table->decimal('paid_amount', 12, 2)->nullable()->after('subtotal');
            $table->decimal('change_amount', 12, 2)->nullable()->after('paid_amount');
            $table->timestamp('paid_at')->nullable()->after('change_amount');
        });
    }

    public function down(): void
    {
        Schema::table('order_item_batches', function (Blueprint $table) {
            $table->dropColumn([
                'payment_method',
                'payment_status',
                'subtotal',
                'paid_amount',
                'change_amount',
                'paid_at',
            ]);
        });
    }
};
