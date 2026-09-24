<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Latest purchase price per unit (shown in the table)
        Schema::table('accessories', function (Blueprint $table) {
            $table->decimal('unit_price', 10, 2)->nullable()->after('quantity');
        });

        // Every stock movement of every product
        Schema::create('accessory_stock_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('accessory_id')->constrained('accessories')->cascadeOnDelete();
            $table->string('type', 20);              // initial | restock | removed
            $table->integer('quantity_change');      // +10 / -2
            $table->integer('quantity_after');       // stock after this entry
            $table->decimal('unit_price', 10, 2)->nullable(); // price per piece (null for removals / old data)
            $table->string('note')->nullable();
            $table->timestamps();
        });

        // Existing items: create an "opening stock" entry so they have a history too.
        // (Price is unknown for old items, so it stays empty.)
        $now = now();
        $rows = DB::table('accessories')
            ->where('quantity', '>', 0)
            ->get(['id', 'quantity', 'created_at'])
            ->map(fn ($a) => [
                'accessory_id'    => $a->id,
                'type'            => 'initial',
                'quantity_change' => $a->quantity,
                'quantity_after'  => $a->quantity,
                'unit_price'      => null,
                'note'            => 'Opening stock',
                'created_at'      => $a->created_at ?? $now,
                'updated_at'      => $now,
            ])
            ->all();

        if (!empty($rows)) {
            DB::table('accessory_stock_logs')->insert($rows);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('accessory_stock_logs');

        Schema::table('accessories', function (Blueprint $table) {
            $table->dropColumn('unit_price');
        });
    }
};