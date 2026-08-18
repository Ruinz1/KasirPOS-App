<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_daily_overheads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->onDelete('cascade');
            $table->foreignId('inventory_item_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null'); // yang menginput
            $table->date('date');                                  // tanggal overhead
            $table->decimal('quantity_used', 10, 4);              // misal 60 (liter kuah)
            $table->string('unit', 50)->nullable();                // liter, kg, pcs, dll
            $table->decimal('price_per_unit', 12, 4)->default(0); // harga per unit saat dicatat
            $table->decimal('cost_amount', 12, 2)->default(0);    // total biaya overhead
            $table->string('notes')->nullable();                   // "kuah soto ayam harian", "gas LPG", dll
            $table->timestamps();

            $table->index(['store_id', 'date']);
            $table->index(['inventory_item_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_daily_overheads');
    }
};
