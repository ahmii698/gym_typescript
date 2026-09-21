<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Admin
        User::updateOrCreate(
            ['email' => 'xahmedmalik306@gmail.com'],
            [
                'name' => 'ahmed',
                'phone' => '03322751363',
                'password' => 'password',
                'role' => 'admin',
            ]
        );

        // Frontdesk
        User::updateOrCreate(
            ['email' => 'xahmedmalik30600@gmail.com'],
            [
                'name' => 'hamza',
                'phone' => '03322751363',
                'password' => 'password',
                'role' => 'frontdesk',
            ]
        );
    }
}