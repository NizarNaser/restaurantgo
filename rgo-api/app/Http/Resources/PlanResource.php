<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'name'                  => $this->name,
            'slug'                  => $this->slug,
            'description'           => $this->description,
            'price_monthly'         => (float) $this->price_monthly,
            'price_yearly'          => (float) $this->price_yearly,
            'currency'              => $this->currency,
            'max_branches'          => $this->max_branches,
            'max_menu_items'        => $this->max_menu_items,
            'max_users'             => $this->max_users,
            'has_custom_domain'     => $this->has_custom_domain,
            'has_white_label'       => $this->has_white_label,
            'has_advanced_reports'  => $this->has_advanced_reports,
            'has_api_access'        => $this->has_api_access,
            'has_qr_ordering'       => $this->has_qr_ordering,
            'available_for_online_purchase' => [
                'monthly' => (bool) $this->stripe_price_id_monthly,
                'yearly'  => (bool) $this->stripe_price_id_yearly,
            ],
        ];
    }
}
