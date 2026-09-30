<?php

namespace App\Console\Commands;

use App\Models\Article;
use Illuminate\Console\Command;

class PublishScheduledArticles extends Command
{
    protected $signature = 'articles:publish-scheduled';

    protected $description = 'Flip scheduled articles whose publish_at has passed to published, and drop their tenant sitemap cache.';

    public function handle(): int
    {
        $due = Article::where('status', Article::STATUS_SCHEDULED)
            ->whereNotNull('publish_at')
            ->where('publish_at', '<=', now())
            ->get();

        foreach ($due as $article) {
            $article->update(['status' => Article::STATUS_PUBLISHED]);
            cache()->forget("sitemap:tenant:{$article->tenant_id}");
        }

        $this->info("Published {$due->count()} scheduled article(s).");

        return self::SUCCESS;
    }
}
