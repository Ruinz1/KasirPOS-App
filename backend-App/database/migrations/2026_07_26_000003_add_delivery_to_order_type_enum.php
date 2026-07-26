<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * MySQL tidak bisa pakai Blueprint::enum()->change() langsung untuk ALTER ENUM,
     * jadi gunakan raw SQL.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE `orders` MODIFY COLUMN `order_type` ENUM('dine_in', 'takeaway', 'delivery') NOT NULL DEFAULT 'dine_in'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Konversi kembali baris delivery ke takeaway sebelum rollback
        DB::statement("UPDATE `orders` SET `order_type` = 'takeaway' WHERE `order_type` = 'delivery'");
        DB::statement("ALTER TABLE `orders` MODIFY COLUMN `order_type` ENUM('dine_in', 'takeaway') NOT NULL DEFAULT 'dine_in'");
    }
};
