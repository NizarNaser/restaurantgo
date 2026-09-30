<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * A thin proxy to OpenAI's Chat Completions API, shared by every AI surface
 * in the app (dashboard help, marketing-site visitor chat, the public menu
 * assistant, and per-field/bulk content translation) — no SDK, same plain-
 * HTTP convention as PayPalService/ExchangeRateService. Stateless: the
 * caller owns the running conversation and resends it in full on every
 * call, and owns its own system prompt — this service doesn't know who's
 * asking or why.
 */
class OpenAiService
{
    public function isConfigured(): bool
    {
        return (bool) config('services.openai.key');
    }

    private function assertConfigured(): void
    {
        abort_if(! $this->isConfigured(), 422, 'The AI assistant is not configured yet.');
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function chat(array $messages, string $systemPrompt): string
    {
        $this->assertConfigured();

        $response = Http::withToken(config('services.openai.key'))
            ->post('https://api.openai.com/v1/chat/completions', [
                'model'      => config('services.openai.model'),
                'max_tokens' => 1024,
                'messages'   => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ...$messages,
                ],
            ]);

        abort_if(! $response->successful(), 422, 'The assistant is temporarily unavailable.');

        return (string) $response->json('choices.0.message.content');
    }
}
