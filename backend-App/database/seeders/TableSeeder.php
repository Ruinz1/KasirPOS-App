<?php

namespace Database\Seeders;

use App\Models\Table;
use App\Models\Store;
use Illuminate\Database\Seeder;

class TableSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Get the first store (if exists)
        $store = Store::first();
        
        if (!$store) {
            $this->command->info('No store found. Skipping table seeder.');
            return;
        }

        // Create sample tables
        $tables = [
            ['table_number' => '1', 'capacity' => 4],
            ['table_number' => '2', 'capacity' => 4],
            ['table_number' => '3', 'capacity' => 2],
            ['table_number' => '4', 'capacity' => 2],
            ['table_number' => '5', 'capacity' => 6],
            ['table_number' => '6', 'capacity' => 4],
            ['table_number' => '7', 'capacity' => 4],
            ['table_number' => '8', 'capacity' => 8],
            ['table_number' => 'VIP-1', 'capacity' => 6, 'notes' => 'VIP Area'],
            ['table_number' => 'VIP-2', 'capacity' => 6, 'notes' => 'VIP Area'],
        ];

        foreach ($tables as $tableData) {
            Table::create([
                'table_number' => $tableData['table_number'],
                'capacity' => $tableData['capacity'],
                'notes' => $tableData['notes'] ?? null,
                'status' => 'available',
                'store_id' => $store->id,
            ]);
        }

        $this->command->info('Tables seeded successfully!');
    }
}
