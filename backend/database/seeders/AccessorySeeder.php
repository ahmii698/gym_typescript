<?php

namespace Database\Seeders;

use App\Models\Accessory;
use Illuminate\Database\Seeder;

class AccessorySeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['Dumbbell 2kg', 'Dumbbells', 9],
            ['Dumbbell 3kg', 'Dumbbells', 6],
            ['Dumbbell 5kg', 'Dumbbells', 8],
            ['Dumbbell 10kg', 'Dumbbells', 4],
            ['Barbell Rod (7ft)', 'Rods', 3],
            ['Curl Rod', 'Rods', 5],
            ['Tricep Rope', 'Attachments', 7],
            ['Lat Pulldown Bar', 'Attachments', 4],
            ['Weight Plates 5kg', 'Weights', 12],
            ['Weight Plates 10kg', 'Weights', 8],
            ['Yoga Mat', 'Accessories', 10],
            ['Resistance Band', 'Accessories', 6],
            ['Ab Roller', 'Accessories', 3],
            ['Push Up Bar', 'Accessories', 2],
            ['Gym Gloves', 'Accessories', 0],
            ['Dumbbell 7kg', 'Dumbbells', 5],
            ['Dumbbell 12kg', 'Dumbbells', 4],
            ['Dumbbell 15kg', 'Dumbbells', 3],
            ['Dumbbell 20kg', 'Dumbbells', 6],
            ['EZ Curl Bar', 'Rods', 4],
            ['Olympic Bar (5ft)', 'Rods', 2],
            ['Trap Bar', 'Rods', 3],
            ['Straight Bar Attachment', 'Attachments', 6],
            ['V-Grip Handle', 'Attachments', 5],
            ['Ankle Strap', 'Attachments', 8],
            ['Weight Plates 2.5kg', 'Weights', 14],
            ['Weight Plates 15kg', 'Weights', 6],
            ['Weight Plates 20kg', 'Weights', 4],
            ['Kettlebell 8kg', 'Weights', 5],
            ['Kettlebell 12kg', 'Weights', 3],
            ['Jump Rope', 'Accessories', 9],
            ['Foam Roller', 'Accessories', 5],
            ['Lifting Belt', 'Accessories', 4],
            ['Wrist Wraps', 'Accessories', 7],
            ['Gym Towel', 'Accessories', 15],
            ['Shaker Bottle', 'Accessories', 11],
            ['Ankle Weights', 'Accessories', 0],
            ['Medicine Ball', 'Weights', 6],
            ['Ab Wheel Mat', 'Accessories', 8],
            ['Pull Up Assist Band', 'Accessories', 5],
            ['Barbell Collar', 'Attachments', 10],
            ['Dip Belt', 'Attachments', 4],
            ['Cable Rope Handle', 'Attachments', 6],
            ['Speed Rope', 'Accessories', 7],
            ['Grip Trainer', 'Accessories', 9],
        ];

        foreach ($items as [$name, $category, $qty]) {
            $accessory = new Accessory([
                'name'     => $name,
                'category' => $category,
                'quantity' => $qty,
            ]);
            $accessory->updateStatusFromQuantity();
            $accessory->save();
        }
    }
}