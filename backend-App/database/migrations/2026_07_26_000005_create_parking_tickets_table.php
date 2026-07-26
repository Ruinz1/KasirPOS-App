<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parking_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number'); // Nomor urut karcis, reset harian (misal: 0001)
            $table->foreignId('store_id')->nullable()->constrained('stores')->onDelete('cascade');
            $table->enum('vehicle_type', ['motor', 'mobil']);
            $table->integer('fee'); // Tarif flat sesuai jenis kendaraan saat karcis dicetak
            $table->enum('status', ['active', 'checked_out'])->default('active');
            $table->foreignId('checked_in_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('checked_out_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('checked_out_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parking_tickets');
    }
};
