<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_shopping', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // Yang input
            $table->string('item_name'); // Nama barang
            $table->decimal('quantity', 10, 2); // Jumlah
            $table->string('unit')->default('pcs'); // Satuan (kg, pcs, liter, dll)
            $table->decimal('price_per_unit', 10, 2); // Harga per satuan
            $table->decimal('total_price', 10, 2); // Total harga
            $table->enum('status', ['baru', 'habis', 'sisa', 'belum_digunakan'])->default('baru');
            $table->text('notes')->nullable();
            $table->date('shopping_date'); // Tanggal belanja
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_shopping');
    }
};
