<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StaffResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'email'         => $this->email,
            'phone'         => $this->phone,
            'position'      => $this->position,
            'department'    => $this->department,
            'base_salary'   => $this->base_salary,
            'currency'      => $this->currency ?? 'USD',
            'overtime_rate' => $this->overtime_rate,
            'hire_date'     => $this->hire_date?->format('Y-m-d'),
            'status'        => $this->status,
            'notes'         => $this->notes,
            'has_login'       => (bool) $this->user_id,
            'role'            => $this->whenLoaded('user', fn () => $this->user?->getRoleNames()->first()),
            'login_email'     => $this->whenLoaded('user', fn () => $this->user?->email),
            'login_is_active' => $this->whenLoaded('user', fn () => $this->user?->is_active),
        ];
    }
}
