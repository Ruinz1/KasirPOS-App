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
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['stock', 'equipment'])->default('stock');
            
            // Fields for stock type
            $table->decimal('current_stock', 10, 2)->nullable();
            $table->string('unit')->nullable(); // gram, ml, pcs, kg, liter
            $table->decimal('price_per_unit', 10, 2)->nullable();
            $table->decimal('min_stock', 10, 2)->nullable();
            
            // Fields for equipment type
            $table->decimal('total_price', 10, 2)->nullable();
            
            // Common fields
            $table->string('category');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
