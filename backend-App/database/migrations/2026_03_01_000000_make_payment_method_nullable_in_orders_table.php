<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Ubah payment_method menjadi nullable agar bisa disimpan NULL saat pilihan "Bayar Nanti"
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_method', ['cash', 'card', 'qris'])->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Kembalikan ke non-nullable (set default 'cash' dulu untuk data yang NULL)
            \DB::statement("UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL");
            $table->enum('payment_method', ['cash', 'card', 'qris'])->nullable(false)->change();
        });
    }
};
