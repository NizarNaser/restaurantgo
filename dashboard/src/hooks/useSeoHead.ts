import { useEffect } from 'react';

export interface SeoPayload {
  title: string;
  description: string | null;
  canonical: string;
  robots: string;
  alternates: { hreflang: string; href: string }[];
  og: Record<string, string>;
  twitter: Record<string, string>;
  google_site_verification?: string | null;
}

const MANAGED = 'data-seo-managed';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    tag.setAttribute(MANAGED, '');
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (hreflang) link.hreflang = hreflang;
  link.setAttribute(MANAGED, '');
  document.head.appendChild(link);
}

/**
 * Writes the SEO payload the public API returns into <head>: title, meta
 * description, robots, canonical, hreflang alternates, Open Graph / Twitter
 * cards and any JSON-LD blocks.
 *
 * This is a client-side render, so crawlers that don't execute JavaScript see
 * only the static index.html. Sprint 2 of the plan calls for moving the public
 * pages to SSR (Next.js); until then the same payload is what the SSR layer
 * will consume, and the sitemap at /p/{slug}/sitemap.xml is already static.
 */
export function useSeoHead(seo?: SeoPayload | null, jsonLd?: unknown[] | null) {
  useEffect(() => {
    if (!seo) return;

    const previousTitle = document.title;
    document.title = seo.title;

    // Clear whatever a previous page left behind before writing this one.
    document.head.querySelectorAll(`link[${MANAGED}], script[${MANAGED}]`).forEach((el) => el.remove());

    if (seo.description) upsertMeta('name', 'description', seo.description);
    if (seo.robots) upsertMeta('name', 'robots', seo.robots);
    if (seo.canonical) upsertLink('canonical', seo.canonical);
    // Best-effort: this is a client-rendered SPA, and Google Search Console's
    // HTML-tag verification method wants the tag in the un-rendered HTML —
    // a JS-injected tag may not satisfy it. The DNS TXT record method is the
    // reliable fallback if this doesn't verify.
    if (seo.google_site_verification) upsertMeta('name', 'google-site-verification', seo.google_site_verification);

    seo.alternates?.forEach((alt) => upsertLink('alternate', alt.href, alt.hreflang));

    Object.entries(seo.og ?? {}).forEach(([key, value]) => upsertMeta('property', key, value));
    Object.entries(seo.twitter ?? {}).forEach(([key, value]) => upsertMeta('name', key, value));

    (jsonLd ?? []).forEach((block) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(MANAGED, '');
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    });

    return () => {
      document.title = previousTitle;
      document.head.querySelectorAll(`link[${MANAGED}], script[${MANAGED}]`).forEach((el) => el.remove());
    };
  }, [seo, jsonLd]);
}
