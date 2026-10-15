<?php

namespace App\Http\Requests;

use App\Models\Member;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'full_name'          => ['required', 'string', 'max:255'],
            'cnic'               => ['required', 'string', 'max:15'],

            // CNIC images optional
            'cnic_front'         => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'cnic_back'          => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],

            'contact_number'     => ['required', 'string', 'max:20'],
            'email'              => ['nullable', 'email', 'max:255'],
            'date_of_birth'      => ['nullable', 'date'],
            'gender'             => ['nullable', Rule::in(['male', 'female', 'other'])],

            'member_type'        => ['required', Rule::in([
                'normal_user',
                'normal_trainer',
                'package_trainer',
                'package_only',
            ])],
            'package_id'         => ['required', 'integer', 'exists:packages,id'],
            'trainer_id'         => [
                Rule::requiredIf(fn () => in_array($this->input('member_type'), Member::TRAINER_TYPES, true)),
                'nullable',
                'integer',
                'exists:trainers,id',
            ],

            'start_date'         => ['required', 'date'],
            'end_date'           => ['nullable', 'date', 'after_or_equal:start_date'],
            'notes'              => ['nullable', 'string'],

            'fee_amount'         => ['nullable', 'numeric', 'min:0'],
            'payment_status'     => ['nullable', Rule::in(['paid', 'pending', 'partial'])],
            'installment_months' => ['nullable', 'integer', 'min:1', 'max:60'],
        ];
    }
}