<?php

namespace App\Http\Controllers;

use App\Models\FixedExpense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class FixedExpenseController extends Controller
{
    /**
     * Get all fixed expenses (sorted by latest date first)
     */
    public function index()
    {
        try {
            $expenses = FixedExpense::orderBy('date', 'desc')
                                    ->orderBy('id', 'desc')
                                    ->get();

            return response()->json([
                'status' => true,
                'data' => $expenses,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Expenses load nahi ho sake.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a new fixed expense
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $expense = FixedExpense::create([
                'title' => $request->title,
                'amount' => $request->amount,
                'date' => $request->date,
            ]);

            return response()->json([
                'status' => true,
                'message' => 'Expense successfully add ho gaya.',
                'data' => $expense,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Expense add nahi ho saka.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an existing fixed expense
     */
    public function update(Request $request, $id)
    {
        $expense = FixedExpense::find($id);

        if (!$expense) {
            return response()->json([
                'status' => false,
                'message' => 'Expense nahi mila.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'amount' => 'sometimes|required|numeric|min:0',
            'date' => 'sometimes|required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $expense->update($request->only(['title', 'amount', 'date']));

            return response()->json([
                'status' => true,
                'message' => 'Expense update ho gaya.',
                'data' => $expense,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Expense update nahi ho saka.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a fixed expense
     */
    public function destroy($id)
    {
        $expense = FixedExpense::find($id);

        if (!$expense) {
            return response()->json([
                'status' => false,
                'message' => 'Expense nahi mila.',
            ], 404);
        }

        try {
            $expense->delete();

            return response()->json([
                'status' => true,
                'message' => 'Expense delete ho gaya.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Expense delete nahi ho saka.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}