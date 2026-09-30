<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MenuItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'menu_category_id' => ['required', 'integer', 'exists:menu_categories,id'],
            'is_available'=> ['boolean'],
            'is_featured' => ['boolean'],
            'weight'      => ['nullable', 'string', 'max:50'],
            'sort_order'  => ['integer'],
            'seo_title'         => ['nullable', 'array'],
            'seo_title.*'       => ['nullable', 'string', 'max:255'],
            'seo_description'   => ['nullable', 'array'],
            'seo_description.*' => ['nullable', 'string', 'max:500'],
            'seo_og_image'      => ['nullable', 'string', 'max:2048'],
            'translations'=> ['array'],
            'prices'      => ['array'],
            'translations.*.locale' => ['required', 'string'],
            'translations.*.name' => ['required', 'string'],
            'translations.*.description' => ['nullable', 'string'],
            'prices.*.currency' => ['required', 'string'],
            'prices.*.price' => ['required', 'numeric'],
        ];
    }
}
