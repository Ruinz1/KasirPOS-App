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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // Kasir who created the order
            $table->string('customer_name')->nullable(); // Free text input for customer name
            $table->decimal('total', 10, 2);
            $table->decimal('cogs', 10, 2); // Cost of Goods Sold
            $table->decimal('profit', 10, 2);
            $table->enum('payment_method', ['cash', 'card', 'qris']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
