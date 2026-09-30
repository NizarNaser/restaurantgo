<?php
/**
 * Dynamic-rendering shim for search/AI crawlers on shared (non-Docker)
 * hosting: this SPA is client-rendered, so a crawler that doesn't execute
 * JavaScript (most of them — GPTBot, ClaudeBot, PerplexityBot, and every
 * search engine besides Google/Bing) only ever sees an empty
 * `<div id="root">` at `/p/{slug}`. dashboard/.htaccess routes ONLY
 * requests from a known crawler user-agent on that path here; every human
 * visitor keeps hitting the static index.html exactly as before — same
 * URL, same content either way, just rendered on the server for bots that
 * can't run the client-side render themselves.
 *
 * Set RESTAURANTGO_API_URL below (or via an Apache SetEnv in .htaccess) to
 * this deployment's API origin before going live.
 */

$apiUrl = getenv('RESTAURANTGO_API_URL') ?: 'https://api.restaurantgo.org';

$slug = '';
if (preg_match('#/p/([^/]+)#', $_SERVER['REQUEST_URI'] ?? '', $m)) {
    $slug = $m[1];
}

$fallbackToSpa = function (): void {
    http_response_code(200);
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/index.html');
    exit;
};

if ($slug === '') {
    $fallbackToSpa();
}

$ch = curl_init(rtrim($apiUrl, '/') . '/p/' . rawurlencode($slug) . '/preview');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 5,
    CURLOPT_CONNECTTIMEOUT => 3,
]);
$html = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($html === false || $status >= 400) {
    $fallbackToSpa();
}

header('Content-Type: text/html; charset=UTF-8');
echo $html;
