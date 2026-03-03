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
        Schema::create('tables', function (Blueprint $table) {
            $table->id();
            $table->string('table_number'); // Nomor meja (bisa string untuk fleksibilitas: "A1", "B2", dll)
            $table->enum('status', ['available', 'occupied', 'reserved'])->default('available');
            $table->foreignId('store_id')->nullable()->constrained('stores')->onDelete('cascade');
            $table->foreignId('current_order_id')->nullable()->constrained('orders')->onDelete('set null');
            $table->integer('capacity')->default(4); // Kapasitas kursi
            $table->text('notes')->nullable(); // Catatan tambahan
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tables');
    }
};
