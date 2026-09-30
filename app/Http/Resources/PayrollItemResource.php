<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'employee_id'    => $this->employee_id,
            'employee_name'  => $this->whenLoaded('employee', fn() => $this->employee?->name),
            'position'       => $this->whenLoaded('employee', fn() => $this->employee?->position),
            'hours_worked'   => (float) $this->hours_worked,
            'base_salary'    => (float) $this->base_salary,
            'overtime_pay'   => (float) $this->overtime_pay,
            'bonuses'        => (float) $this->bonuses,
            'deductions'     => (float) $this->deductions,
            'net_salary'     => (float) $this->net_salary,
            'notes'          => $this->notes,
        ];
    }
}
