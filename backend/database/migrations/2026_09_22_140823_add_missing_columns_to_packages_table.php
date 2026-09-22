<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->string('type')->default('Normal')->after('name');
            $table->json('features')->nullable()->after('is_active');
            $table->string('icon')->default('dumbbell')->after('features');
        });
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn(['type', 'features', 'icon']);
        });
    }
};