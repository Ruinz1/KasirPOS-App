<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->onDelete('cascade');
            $table->foreignId('inventory_item_id')->constrained()->onDelete('cascade');
            $table->foreignId('order_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('order_item_id')->nullable()->constrained()->onDelete('set null');
            $table->decimal('quantity_used', 10, 4);          // berapa banyak dipotong
            $table->string('unit', 50)->nullable();            // liter, gram, pcs, dll
            $table->decimal('price_per_unit', 12, 4)->default(0); // harga snapshot saat digunakan
            $table->decimal('cost_amount', 12, 2)->default(0);    // quantity_used × price_per_unit
            $table->enum('usage_type', ['order', 'overhead', 'waste', 'adjustment'])->default('order');
            $table->string('notes')->nullable();
            $table->date('usage_date');                        // tanggal pemakaian (untuk query harian/bulanan)
            $table->timestamps();

            $table->index(['store_id', 'usage_date']);
            $table->index(['inventory_item_id', 'usage_date']);
            $table->index(['order_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_usage_logs');
    }
};
