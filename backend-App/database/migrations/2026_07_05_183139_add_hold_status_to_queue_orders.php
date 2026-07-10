<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE orders MODIFY COLUMN queue_status ENUM('pending', 'in_progress', 'completed', 'hold') DEFAULT 'pending'");
        DB::statement("ALTER TABLE orders MODIFY COLUMN drink_queue_status ENUM('pending', 'completed', 'hold') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE orders MODIFY COLUMN queue_status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending'");
        DB::statement("ALTER TABLE orders MODIFY COLUMN drink_queue_status ENUM('pending', 'completed') DEFAULT 'pending'");
    }
};
