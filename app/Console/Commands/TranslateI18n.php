<?php

namespace App\Console\Commands;

use App\Services\OpenAiService;
use Illuminate\Console\Command;

/**
 * Fills in missing keys across the dashboard/web frontends' i18n locale
 * files using OpenAI — a developer-facing dev tool, not a runtime feature.
 * Never overwrites a key a human has already translated (even an imperfect
 * one); it only adds keys that are missing or empty in a target locale.
 */
class TranslateI18n extends Command
{
    protected $signature = 'i18n:translate {app=all : dashboard|web|all} {--source=en} {--dry-run}';

    protected $description = "Fill in missing i18n translation keys in the dashboard/web frontends using OpenAI.";

    public function handle(OpenAiService $openai): int
    {
        $apps = $this->argument('app') === 'all' ? ['dashboard', 'web'] : [$this->argument('app')];
        $source = $this->option('source');

        foreach ($apps as $app) {
            $this->translateApp($app, $source, $openai);
        }

        return self::SUCCESS;
    }

    private function translateApp(string $app, string $source, OpenAiService $openai): void
    {
        $dir = base_path("../{$app}/src/i18n/locales");

        if (! is_dir($dir)) {
            $this->error("{$app}: locales directory not found at {$dir}");
            return;
        }

        $sourcePath = "{$dir}/{$source}.json";
        if (! file_exists($sourcePath)) {
            $this->error("{$app}: source file {$source}.json not found.");
            return;
        }

        $sourceFlat = $this->flatten(json_decode(file_get_contents($sourcePath), true) ?? []);

        foreach (glob("{$dir}/*.json") as $path) {
            $locale = basename($path, '.json');
            if ($locale === $source) {
                continue;
            }

            $targetFlat = $this->flatten(json_decode(file_get_contents($path), true) ?? []);

            $missing = [];
            foreach ($sourceFlat as $key => $value) {
                if (! isset($targetFlat[$key]) || $targetFlat[$key] === '') {
                    $missing[$key] = $value;
                }
            }

            if (empty($missing)) {
                $this->line("{$app}/{$locale}: already up to date.");
                continue;
            }

            if ($this->option('dry-run')) {
                $this->line("{$app}/{$locale}: would translate " . count($missing) . ' key(s): ' . implode(', ', array_keys($missing)));
                continue;
            }

            $translated = $this->translateKeys($openai, $missing, $locale);
            if ($translated === null) {
                $this->error("{$app}/{$locale}: OpenAI did not return a usable translation, skipped.");
                continue;
            }

            $merged = array_merge($targetFlat, $translated);
            file_put_contents($path, json_encode($this->unflatten($merged), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

            $this->info("{$app}/{$locale}: translated " . count($translated) . ' key(s).');
        }
    }

    /**
     * @param  array<string, string>  $missing
     * @return array<string, string>|null
     */
    private function translateKeys(OpenAiService $openai, array $missing, string $targetLocale): ?array
    {
        $systemPrompt = <<<PROMPT
            You translate UI copy for a software product's interface, given as a JSON object mapping opaque dot-path keys to English text. Translate every value into the language identified by the ISO 639-1 code "{$targetLocale}". Preserve any {{interpolation}} placeholders and any inline tags like <hl>...</hl> exactly as they appear — do not translate or alter their contents. Respond with ONLY a valid JSON object using the exact same keys, translated values — no prose, no markdown code fences.
            PROMPT;

        // OpenAiService raises an HttpException (via abort_if) on failure —
        // fine inside a controller, where Laravel's HTTP pipeline turns it
        // into a JSON response, but there's no such pipeline here, so left
        // uncaught it would crash the whole command instead of just this
        // locale.
        try {
            $reply = $openai->chat(
                [['role' => 'user', 'content' => json_encode($missing, JSON_UNESCAPED_UNICODE)]],
                $systemPrompt,
            );
        } catch (\Throwable $e) {
            $this->error("OpenAI request failed: {$e->getMessage()}");
            return null;
        }

        $decoded = json_decode($reply, true);
        if (! is_array($decoded)) {
            return null;
        }

        // Only keep keys we actually asked for, translated as strings —
        // guards against a reply that adds, drops, or reshapes keys.
        $result = [];
        foreach ($missing as $key => $_) {
            if (isset($decoded[$key]) && is_string($decoded[$key])) {
                $result[$key] = $decoded[$key];
            }
        }

        return empty($result) ? null : $result;
    }

    private function flatten(array $data, string $prefix = ''): array
    {
        $result = [];
        foreach ($data as $key => $value) {
            $path = $prefix === '' ? $key : "{$prefix}.{$key}";
            if (is_array($value)) {
                $result += $this->flatten($value, $path);
            } else {
                $result[$path] = (string) $value;
            }
        }
        return $result;
    }

    private function unflatten(array $flat): array
    {
        $result = [];
        foreach ($flat as $path => $value) {
            $segments = explode('.', $path);
            $cursor = &$result;
            foreach ($segments as $i => $segment) {
                if ($i === count($segments) - 1) {
                    $cursor[$segment] = $value;
                } else {
                    if (! isset($cursor[$segment]) || ! is_array($cursor[$segment])) {
                        $cursor[$segment] = [];
                    }
                    $cursor = &$cursor[$segment];
                }
            }
            unset($cursor);
        }
        return $result;
    }
}
