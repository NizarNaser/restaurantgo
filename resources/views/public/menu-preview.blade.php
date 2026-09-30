<!doctype html>
<html lang="{{ $locale }}" dir="{{ in_array($locale, ['ar', 'he', 'fa', 'ur']) ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="UTF-8">
    <title>{{ $seo['title'] }}</title>
    @if ($seo['description'])
        <meta name="description" content="{{ $seo['description'] }}">
    @endif
    <link rel="canonical" href="{{ $seo['canonical'] }}">
    <meta name="robots" content="{{ $seo['robots'] }}">
    @foreach ($seo['og'] as $property => $content)
        <meta property="{{ $property }}" content="{{ $content }}">
    @endforeach
    @foreach ($seo['twitter'] as $name => $content)
        <meta name="{{ $name }}" content="{{ $content }}">
    @endforeach
    @if ($seo['google_site_verification'])
        <meta name="google-site-verification" content="{{ $seo['google_site_verification'] }}">
    @endif
    @foreach ($jsonLd as $block)
        <script type="application/ld+json">{!! json_encode($block, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}</script>
    @endforeach
    <style>
        body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
        h1 { margin-bottom: 0.25rem; }
        .tagline { color: #555; margin-top: 0; }
        h2 { margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
        .item { margin: 0.75rem 0; }
        .item .name { font-weight: 600; }
        .item .price { float: inline-end; color: #444; }
        .item .desc { color: #555; font-size: 0.95em; margin: 0.15rem 0 0; }
        .contact { margin-top: 2rem; font-size: 0.95em; color: #444; }
    </style>
</head>
<body>
    <h1>{{ $tenant->name }}</h1>
    @if ($seo['description'])
        <p class="tagline">{{ $seo['description'] }}</p>
    @endif

    @foreach ($categories as $category)
        @php($categoryItems = $items->where('menu_category_id', $category->id))
        @continue($categoryItems->isEmpty())
        <h2>{{ $category->translation($locale)?->name ?? $category->translation()?->name }}</h2>
        @foreach ($categoryItems as $item)
            <div class="item">
                <span class="name">{{ $item->translation($locale)?->name ?? $item->translation()?->name }}</span>
                <span class="price">{{ $item->prices->first()?->price ?? $item->base_price }} {{ $item->prices->first()?->currency ?? $tenant->default_currency }}</span>
                @if ($item->translation($locale)?->description)
                    <p class="desc">{{ $item->translation($locale)->description }}</p>
                @endif
            </div>
        @endforeach
    @endforeach

    @if ($branch)
        <div class="contact">
            @if ($branch->address){{ $branch->address }}@if($branch->city), {{ $branch->city }}@endif<br>@endif
            @if ($branch->phone)<a href="tel:{{ $branch->phone }}">{{ $branch->phone }}</a><br>@endif
            @if (is_array($branch->working_hours))
                @foreach ($branch->working_hours as $day => $hours)
                    {{ $day }}: {{ is_array($hours) ? implode('–', $hours) : $hours }}<br>
                @endforeach
            @endif
        </div>
    @endif

    <p><a href="{{ $menuUrl }}">{{ $menuUrl }}</a></p>
</body>
</html>
