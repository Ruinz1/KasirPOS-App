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
        Schema::create('order_item_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->unsignedInteger('batch_number'); // 1, 2, 3, ... per order (batch 0 = pesanan awal, tidak punya row)
            $table->enum('queue_status', ['pending', 'in_progress', 'completed', 'hold'])->default('pending');
            $table->enum('drink_queue_status', ['pending', 'completed', 'hold'])->default('pending');
            $table->timestamp('queue_completed_at')->nullable();
            $table->string('hold_reason')->nullable();
            $table->string('drink_hold_reason')->nullable();
            $table->timestamps();

            $table->unique(['order_id', 'batch_number']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('batch_id')->nullable()->after('is_addon')
                ->constrained('order_item_batches')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['batch_id']);
            $table->dropColumn('batch_id');
        });

        Schema::dropIfExists('order_item_batches');
    }
};
