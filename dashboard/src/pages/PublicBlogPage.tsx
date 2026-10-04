import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSeoHead } from '../hooks/useSeoHead';
import type { SeoPayload } from '../hooks/useSeoHead';
import { getStoredPublicLocale } from '../lib/publicLocale';
import { usePublicSlug } from '../hooks/usePublicSlug';
import PublicPageHeader from '../components/public/PublicPageHeader';
import PublicFooter from '../components/public/PublicFooter';
import type { RestaurantInfo } from '../types/public';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

/** Shared by both pages below — just enough for the branded header/footer. */
function useRestaurantInfo(slug: string | undefined) {
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  useEffect(() => {
    if (!slug) return;
    axios
      .get(`${PUBLIC_API}/${slug}/info`, { params: { lang: getStoredPublicLocale(slug) ?? undefined } })
      .then((res) => setInfo(res.data.data))
      .catch(() => {});
  }, [slug]);
  return info;
}

interface ArticleSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  locale: string;
  published_at: string | null;
  author: string | null;
  featured_image: string | null;
}

interface ArticleDetail extends ArticleSummary {
  content: string;
  updated_at: string | null;
  translations: { hreflang: string; href: string }[];
}

function isRtl(locale?: string | null) {
  return locale === 'ar' || locale === 'he' || locale === 'fa';
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Blog index for a restaurant's public site. */
export function PublicBlogPage() {
  const { t } = useTranslation();
  const { slug, buildPath } = usePublicSlug();
  const info = useRestaurantInfo(slug);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [seo, setSeo] = useState<SeoPayload | null>(null);
  const [jsonLd, setJsonLd] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeoHead(seo, jsonLd);

  useEffect(() => {
    axios
      .get(`${PUBLIC_API}/${slug}/articles`, { params: { lang: getStoredPublicLocale(slug) ?? undefined } })
      .then((res) => {
        setArticles(res.data.data);
        setSeo(res.data.seo);
        setJsonLd(res.data.json_ld);
      })
      .catch((err) => setError(err.response?.data?.message || t('blog.blogUnavailable')))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading || !info) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('common.oops')}</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicPageHeader
        info={info}
        slug={slug}
        buildPath={buildPath}
        title={seo?.title}
        subtitle={seo?.description ?? undefined}
      />

      <div className="max-w-3xl mx-auto px-4 mt-8 space-y-5 flex-1 w-full">
        {articles.length === 0 && (
          <p className="text-center text-gray-500 py-12">{t('blog.noPosts')}</p>
        )}

        {articles.map((article) => (
          <Link
            key={article.id}
            to={buildPath(`/blog/${encodeURIComponent(article.slug)}`)}
            dir={isRtl(article.locale) ? 'rtl' : 'ltr'}
            className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            {article.featured_image && (
              <img src={article.featured_image} alt="" className="w-full h-48 object-cover" />
            )}
            <div className="p-5">
              <h2 className="text-xl font-semibold text-gray-900">{article.title}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {formatDate(article.published_at, article.locale)}
                {article.author ? ` · ${article.author}` : ''}
              </p>
              {article.excerpt && <p className="text-gray-600 mt-3">{article.excerpt}</p>}
            </div>
          </Link>
        ))}
      </div>

      <PublicFooter info={info} buildPath={buildPath} />
    </div>
  );
}

/** A single public article. */
export function PublicArticlePage() {
  const { t } = useTranslation();
  const { articleSlug } = useParams<{ articleSlug: string }>();
  const { slug, buildPath } = usePublicSlug();
  const info = useRestaurantInfo(slug);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [seo, setSeo] = useState<SeoPayload | null>(null);
  const [jsonLd, setJsonLd] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeoHead(seo, jsonLd);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${PUBLIC_API}/${slug}/articles/${encodeURIComponent(articleSlug ?? '')}`)
      .then((res) => {
        setArticle(res.data.data);
        setSeo(res.data.seo);
        setJsonLd(res.data.json_ld);
      })
      .catch((err) => setError(err.response?.data?.message || t('blog.articleNotFound')))
      .finally(() => setLoading(false));
  }, [slug, articleSlug]);

  if (loading || !info) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('common.notFound')}</h1>
        <p className="text-gray-600">{error}</p>
        <Link to={buildPath('/blog')} className="mt-4 text-red-500 hover:underline">
          {t('blog.backToBlog')}
        </Link>
      </div>
    );
  }

  const rtl = isRtl(article.locale);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicPageHeader info={info} slug={slug} buildPath={buildPath} />

      <article className="flex-1" dir={rtl ? 'rtl' : 'ltr'} lang={article.locale}>
        <div className="max-w-2xl mx-auto px-4 pt-10 pb-20">
          <Link
            to={buildPath('/blog')}
            className="btn btn-primary rounded-full text-sm shadow-sm gap-1.5"
          >
            <ArrowLeft size={16} className={rtl ? 'rotate-180' : ''} />
            {t('blog.backToBlog')}
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mt-4 leading-tight">{article.title}</h1>
          <p className="text-sm text-gray-400 mt-2">
            {formatDate(article.published_at, article.locale)}
            {article.author ? ` · ${article.author}` : ''}
          </p>

          {/* Other languages this post exists in. */}
          {article.translations.length > 1 && (
            <div className="flex gap-2 mt-4">
              {article.translations
                .filter((t) => t.hreflang !== article.locale)
                .map((t) => (
                  <a
                    key={t.hreflang}
                    href={t.href}
                    hrefLang={t.hreflang}
                    className="px-2 py-1 text-xs uppercase rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    {t.hreflang}
                  </a>
                ))}
            </div>
          )}

          {article.featured_image && (
            <img src={article.featured_image} alt="" className="w-full rounded-xl mt-6 object-cover" />
          )}

          <div
            className="prose prose-gray max-w-none mt-8 text-gray-800 leading-relaxed"
            // Content is authored by the restaurant's own staff in the dashboard.
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      </article>

      <PublicFooter info={info} buildPath={buildPath} />
    </div>
  );
}
