import { useEffect } from 'react';

export interface SeoPayload {
  title: string;
  description: string | null;
  canonical?: string;
  robots?: string;
  og?: Record<string, string>;
  twitter?: Record<string, string>;
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

function upsertLink(rel: string, href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    link.setAttribute(MANAGED, '');
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Writes the platform marketing site's SEO into <head>: title, description,
 * canonical, robots, Open Graph / Twitter cards, and the Google Search
 * Console verification meta tag. Mirrors dashboard/src/hooks/useSeoHead.ts
 * (the per-tenant equivalent) — this is a client-side render, so a crawler
 * that doesn't execute JavaScript only sees the static index.html.
 */
export function useSeoHead(seo?: SeoPayload | null) {
  useEffect(() => {
    if (!seo) return;

    const previousTitle = document.title;
    if (seo.title) document.title = seo.title;

    if (seo.description) upsertMeta('name', 'description', seo.description);
    if (seo.robots) upsertMeta('name', 'robots', seo.robots);
    if (seo.canonical) upsertLink('canonical', seo.canonical);
    // Best-effort: this is a client-rendered SPA, and Google Search Console's
    // HTML-tag verification method wants the tag in the un-rendered HTML —
    // the DNS TXT record method is the reliable fallback if this doesn't verify.
    if (seo.google_site_verification) upsertMeta('name', 'google-site-verification', seo.google_site_verification);

    Object.entries(seo.og ?? {}).forEach(([key, value]) => upsertMeta('property', key, value));
    Object.entries(seo.twitter ?? {}).forEach(([key, value]) => upsertMeta('name', key, value));

    return () => {
      document.title = previousTitle;
    };
  }, [seo]);
}
