<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StaffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $staffMember = $this->route('staffMember');
        $existingUserId = $staffMember?->user_id;

        return [
            'name'          => ['required', 'string', 'max:255'],
            'email'         => ['nullable', 'email', 'max:255'],
            'phone'         => ['nullable', 'string', 'max:50'],
            'position'      => ['required', 'string', 'max:255'],
            'department'    => ['nullable', 'string', 'max:255'],
            'base_salary'   => ['required', 'numeric', 'min:0'],
            'currency'      => ['nullable', 'string', 'max:3'],
            'overtime_rate' => ['nullable', 'numeric', 'min:0'],
            'hire_date'     => ['required', 'date'],
            'status'        => ['required', 'in:active,inactive'],
            'bank_account'  => ['nullable', 'string'],
            'notes'         => ['nullable', 'string'],

            // Grant/manage this staff member's login to the company admin panel.
            // When the staff member already has a login, these edit it instead of creating a new one.
            'create_login'  => ['boolean'],
            'login_email'   => [
                Rule::requiredIf(fn () => $existingUserId || $this->boolean('create_login')),
                'nullable', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($existingUserId),
            ],
            'login_password'=> [
                Rule::requiredIf(fn () => $this->boolean('create_login') && ! $existingUserId),
                'nullable', 'string', 'min:8',
            ],
            'role'          => [
                Rule::requiredIf(fn () => $existingUserId || $this->boolean('create_login')),
                'nullable', Rule::in(['super_admin', 'finance_manager', 'support_agent']),
            ],
            'login_is_active' => ['boolean'],
        ];
    }
}
