<?php

namespace App\Http\Requests;

use App\Models\Article;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'branch_id'       => ['nullable', 'integer', 'exists:branches,id'],
            'status'          => ['nullable', Rule::in([Article::STATUS_DRAFT, Article::STATUS_PUBLISHED, Article::STATUS_SCHEDULED])],
            'publish_at'      => ['nullable', 'date', Rule::requiredIf(fn() => $this->status === Article::STATUS_SCHEDULED)],
            'seo_title'         => ['nullable', 'array'],
            'seo_title.*'       => ['nullable', 'string', 'max:255'],
            'seo_description'   => ['nullable', 'array'],
            'seo_description.*' => ['nullable', 'string', 'max:500'],
            'seo_og_image'      => ['nullable', 'string', 'max:2048'],

            'translations'               => [$required, 'array', 'min:1'],
            'translations.*.locale'      => ['required', 'string', 'max:10'],
            'translations.*.title'       => ['required', 'string', 'max:255'],
            'translations.*.slug'        => ['nullable', 'string', 'max:255'],
            'translations.*.content'     => ['required', 'string'],
            'translations.*.excerpt'     => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'translations.min'         => 'An article needs at least one translation.',
            'translations.*.content.required' => 'Every translation needs content.',
        ];
    }
}
