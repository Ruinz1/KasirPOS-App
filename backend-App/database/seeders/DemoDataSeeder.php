<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\InventoryItem;
use App\Models\MenuItem;
use App\Models\MenuIngredient;

class DemoDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create inventory items (stocks)
        $kopi = InventoryItem::create([
            'name' => 'Kopi Arabica',
            'type' => 'stock',
            'current_stock' => 5000,
            'unit' => 'gram',
            'price_per_unit' => 2,
            'min_stock' => 1000,
            'category' => 'Kopi',
        ]);

        $susu = InventoryItem::create([
            'name' => 'Susu Full Cream',
            'type' => 'stock',
            'current_stock' => 10000,
            'unit' => 'ml',
            'price_per_unit' => 0.5,
            'min_stock' => 2000,
            'category' => 'Susu',
        ]);

        $gula = InventoryItem::create([
            'name' => 'Gula Pasir',
            'type' => 'stock',
            'current_stock' => 3000,
            'unit' => 'gram',
            'price_per_unit' => 0.3,
            'min_stock' => 500,
            'category' => 'Pemanis',
        ]);

        $es = InventoryItem::create([
            'name' => 'Es Batu',
            'type' => 'stock',
            'current_stock' => 50,
            'unit' => 'kg',
            'price_per_unit' => 5,
            'min_stock' => 10,
            'category' => 'Es',
        ]);

        // Create equipment
        InventoryItem::create([
            'name' => 'Mesin Espresso',
            'type' => 'equipment',
            'total_price' => 15000000,
            'category' => 'Alat Kopi',
        ]);

        InventoryItem::create([
            'name' => 'Grinder Kopi',
            'type' => 'equipment',
            'total_price' => 3500000,
            'category' => 'Alat Kopi',
        ]);

        InventoryItem::create([
            'name' => 'Kulkas Display',
            'type' => 'equipment',
            'total_price' => 8000000,
            'category' => 'Alat Pendingin',
        ]);

        // Create menu items
        $esKopiSusu = MenuItem::create([
            'name' => 'Es Kopi Susu',
            'category' => 'Kopi',
            'price' => 25000,
        ]);

        // Add ingredients for Es Kopi Susu
        MenuIngredient::create([
            'menu_item_id' => $esKopiSusu->id,
            'inventory_item_id' => $kopi->id,
            'amount' => 20, // 20 gram
        ]);

        MenuIngredient::create([
            'menu_item_id' => $esKopiSusu->id,
            'inventory_item_id' => $susu->id,
            'amount' => 150, // 150 ml
        ]);

        MenuIngredient::create([
            'menu_item_id' => $esKopiSusu->id,
            'inventory_item_id' => $gula->id,
            'amount' => 10, // 10 gram
        ]);

        MenuIngredient::create([
            'menu_item_id' => $esKopiSusu->id,
            'inventory_item_id' => $es->id,
            'amount' => 0.2, // 200 gram = 0.2 kg
        ]);

        // Create another menu item
        $kopiHitam = MenuItem::create([
            'name' => 'Kopi Hitam',
            'category' => 'Kopi',
            'price' => 15000,
        ]);

        MenuIngredient::create([
            'menu_item_id' => $kopiHitam->id,
            'inventory_item_id' => $kopi->id,
            'amount' => 15,
        ]);

        MenuIngredient::create([
            'menu_item_id' => $kopiHitam->id,
            'inventory_item_id' => $gula->id,
            'amount' => 5,
        ]);

        $this->command->info('Demo data seeded successfully!');
    }
}
