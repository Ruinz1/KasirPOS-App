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
        Schema::create('cashier_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('store_id')->constrained('stores')->onDelete('cascade');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->decimal('opening_cash', 15, 2)->default(0);
            $table->decimal('closing_cash', 15, 2)->nullable();
            $table->decimal('expected_cash', 15, 2)->nullable();
            $table->decimal('cash_sales', 15, 2)->nullable();
            $table->decimal('cash_change', 15, 2)->nullable();
            $table->decimal('discrepancy', 15, 2)->nullable();
            $table->unsignedInteger('total_transactions')->nullable();
            $table->decimal('total_revenue', 15, 2)->nullable();
            $table->text('notes_open')->nullable();
            $table->text('notes_close')->nullable();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->timestamps();

            // Index untuk query performa
            $table->index(['user_id', 'status']);
            $table->index(['store_id', 'opened_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cashier_shifts');
    }
};
