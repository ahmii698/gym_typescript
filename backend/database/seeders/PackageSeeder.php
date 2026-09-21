<?php

namespace Database\Seeders;

use App\Models\Package;
use Illuminate\Database\Seeder;

class PackageSeeder extends Seeder
{
    public function run(): void
    {
        $packages = [
            ['name' => 'Monthly',   'duration_days' => 30,  'price' => 5000],
            ['name' => 'Quarterly', 'duration_days' => 90,  'price' => 13500],
            ['name' => 'Half Year', 'duration_days' => 180, 'price' => 25000],
            ['name' => 'Yearly',    'duration_days' => 365, 'price' => 45000],
        ];

        foreach ($packages as $package) {
            Package::firstOrCreate(['name' => $package['name']], $package);
        }
    }
}