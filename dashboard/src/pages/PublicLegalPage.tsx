import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import PublicPageHeader from '../components/public/PublicPageHeader';
import PublicFooter from '../components/public/PublicFooter';
import { useSeoHead } from '../hooks/useSeoHead';
import { usePublicSlug } from '../hooks/usePublicSlug';
import { getStoredPublicLocale } from '../lib/publicLocale';
import type { RestaurantInfo } from '../types/public';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

export type LegalPageKind = 'privacy' | 'terms' | 'accessibility';

// Each section is rendered from a `legal.<kind>.<key>Title` /
// `legal.<kind>.<key>Body` pair in the public locale files.
const SECTIONS: Record<LegalPageKind, string[]> = {
  privacy: ['intro', 'dataCollected', 'dataUse', 'dataSharing', 'cookies', 'rights', 'contact'],
  terms: ['intro', 'intellectualProperty', 'useOfService', 'menuAccuracy', 'liability', 'contact'],
  accessibility: ['intro', 'standards', 'features', 'feedback', 'contact'],
};

/**
 * The legal pages every tenant gets automatically (Privacy Policy, Terms &
 * Copyright Notice, Accessibility Statement) — standard template content
 * covering EU requirements (GDPR, the European Accessibility Act) with the
 * restaurant's own name/contact details filled in. Generic boilerplate, not
 * a substitute for the owner's own legal review of their specific situation
 * — see the notice at the bottom of each page.
 */
export default function PublicLegalPage({ kind }: { kind: LegalPageKind }) {
  const { t, i18n } = useTranslation();
  const { slug, buildPath } = usePublicSlug();
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    axios
      .get(`${PUBLIC_API}/${slug}/info`, { params: { lang: getStoredPublicLocale(slug) ?? undefined } })
      .then((res) => setInfo(res.data.data))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, i18n.language]);

  const title = t(`legal.${kind}.title`);

  useSeoHead(
    info
      ? {
          title: `${title} — ${info.name}`,
          description: null,
          canonical: `${info.blog_url ? info.blog_url.replace(/\/blog$/, '') : window.location.origin}${buildPath(`/${kind}`)}`,
          robots: 'index, follow',
          alternates: [],
          og: {},
          twitter: {},
        }
      : null,
    null,
  );

  if (loading || !info) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir={i18n.dir()}>
      <PublicPageHeader
        info={info}
        slug={slug}
        buildPath={buildPath}
        title={title}
        subtitle={t('legal.disclaimer', { name: info.name })}
      />

      <main className="max-w-3xl mx-auto px-4 py-10 flex-1 space-y-8">
        {SECTIONS[kind].map((key) => (
          <section key={key}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t(`legal.${kind}.${key}Title`)}</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {t(`legal.${kind}.${key}Body`, { name: info.name })}
            </p>
          </section>
        ))}
      </main>

      <PublicFooter info={info} buildPath={buildPath} />
    </div>
  );
}
