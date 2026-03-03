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
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('queue_status', ['pending', 'in_progress', 'completed'])->default('pending')->after('status');
            $table->text('notes')->nullable()->after('queue_status');
            $table->timestamp('queue_completed_at')->nullable()->after('notes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['queue_status', 'notes', 'queue_completed_at']);
        });
    }
};
