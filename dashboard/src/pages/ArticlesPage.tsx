import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Edit, Trash2, Loader2, Globe, Send, EyeOff, ExternalLink, ImagePlus, Image,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';

type Status = 'draft' | 'published' | 'scheduled';

interface Translation {
  id?: number;
  locale: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
}

interface Article {
  id: number;
  status: Status;
  publish_at: string | null;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  locale: string | null;
  locales: string[];
  featured_image: string | null;
  seo_title: Record<string, string> | null;
  seo_description: Record<string, string> | null;
  seo_og_image: string | null;
  url: string | null;
  translations: Translation[];
  author?: { id: number; name: string } | null;
}

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
];

// The SEO section's language tabs follow the restaurant's *full* configured
// language set (Settings → supported_locales), not just the languages this
// article happens to already have a translation for — see MenuPage.tsx's
// identical SEO_LOCALE_LABELS.
const SEO_LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español',
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', tr: 'Türkçe',
  zh: '中文', ja: '日本語',
};

const STATUS_STYLES: Record<Status, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  scheduled: 'bg-amber-100 text-amber-700',
};

const emptyTranslation = (locale: string): Translation => ({
  locale,
  title: '',
  slug: '',
  content: '',
  excerpt: '',
});

export default function ArticlesPage() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');

  const [isEditorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [activeLocale, setActiveLocale] = useState('en');
  const [translations, setTranslations] = useState<Translation[]>([emptyTranslation('en')]);
  const [seo, setSeo] = useState<{ seo_title: Record<string, string>; seo_description: Record<string, string>; seo_og_image: string }>({ seo_title: {}, seo_description: {}, seo_og_image: '' });
  const [activeSeoLocale, setActiveSeoLocale] = useState('en');
  const [supportedLocales, setSupportedLocales] = useState<string[]>(['en']);
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [uploadingContentImage, setUploadingContentImage] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentImageInputRef = useRef<HTMLInputElement>(null);

  const [scheduleFor, setScheduleFor] = useState('');
  const [schedulingId, setSchedulingId] = useState<number | null>(null);

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    api.get('/settings').then((res) => {
      setSupportedLocales(res.data.supported_locales?.length ? res.data.supported_locales : ['en']);
      setActiveSeoLocale(res.data.default_locale || 'en');
    }).catch(() => {});
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/articles', {
        params: { status: statusFilter || undefined, per_page: 50 },
      });
      setArticles(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch articles', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return articles;
    return articles.filter((a) => (a.title ?? '').toLowerCase().includes(term));
  }, [articles, search]);

  // ── Editor ──────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setTranslations([emptyTranslation('en')]);
    setActiveLocale('en');
    setSeo({ seo_title: {}, seo_description: {}, seo_og_image: '' });
    setActiveSeoLocale(supportedLocales[0] ?? 'en');
    setFeaturedImage(null);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (article: Article) => {
    setEditing(article);
    setTranslations(
      article.translations.length
        ? article.translations.map((t) => ({ ...t, excerpt: t.excerpt ?? '' }))
        : [emptyTranslation('en')],
    );
    setActiveLocale(article.translations[0]?.locale ?? 'en');
    setSeo({
      seo_title: article.seo_title ?? {},
      seo_description: article.seo_description ?? {},
      seo_og_image: article.seo_og_image ?? '',
    });
    setActiveSeoLocale(supportedLocales[0] ?? 'en');
    setFeaturedImage(null);
    setFormError(null);
    setEditorOpen(true);
  };

  const current = translations.find((t) => t.locale === activeLocale) ?? translations[0];

  const updateCurrent = (patch: Partial<Translation>) => {
    setTranslations((prev) =>
      prev.map((t) => (t.locale === activeLocale ? { ...t, ...patch } : t)),
    );
  };

  const addLocale = (locale: string) => {
    if (translations.some((t) => t.locale === locale)) {
      setActiveLocale(locale);
      return;
    }
    setTranslations((prev) => [...prev, emptyTranslation(locale)]);
    setActiveLocale(locale);
  };

  const removeLocale = (locale: string) => {
    if (translations.length === 1) return;
    const next = translations.filter((t) => t.locale !== locale);
    setTranslations(next);
    setActiveLocale(next[0].locale);
  };

  // Uploads a picture from the device (computer file browser, or a phone's
  // camera/gallery — the file input offers both automatically) and inserts
  // it as an <img> tag at the cursor's position in the raw-HTML content
  // editor. Not tied to the article's own id (see uploadContentImage on the
  // API side), so this works even while still writing a brand-new,
  // never-yet-saved post.
  const handleContentImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingContentImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/articles/content-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const tag = `<img src="${res.data.url}" alt="" />`;

      const textarea = contentTextareaRef.current;
      const start = textarea?.selectionStart ?? current.content.length;
      const end = textarea?.selectionEnd ?? current.content.length;
      const nextContent = current.content.slice(0, start) + tag + current.content.slice(end);
      updateCurrent({ content: nextContent });

      // Put the cursor right after the inserted tag, same as a native input.
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(start + tag.length, start + tag.length);
      });
    } catch {
      setFormError(t('articles.insertImageFailed'));
    } finally {
      setUploadingContentImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...seo,
      translations: translations
        .filter((t) => t.title.trim() && t.content.trim())
        .map((t) => ({
          locale: t.locale,
          title: t.title,
          // Only send a slug the user actually typed — the API keeps an
          // existing slug stable otherwise, so published URLs don't move.
          slug: t.slug?.trim() || undefined,
          content: t.content,
          excerpt: t.excerpt || undefined,
        })),
    };

    if (payload.translations.length === 0) {
      setFormError(t('articles.needTitleAndContent'));
      return;
    }

    setSubmitting(true);
    try {
      const res = editing
        ? await api.put(`/articles/${editing.id}`, payload)
        : await api.post('/articles', payload);

      if (featuredImage) {
        const form = new FormData();
        form.append('file', featuredImage);
        await api.post(`/articles/${res.data.id}/featured-image`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setEditorOpen(false);
      fetchArticles();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || t('articles.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Publishing ──────────────────────────────────────────────

  const publishNow = async (article: Article) => {
    try {
      await api.post(`/articles/${article.id}/publish`);
      fetchArticles();
    } catch (error: any) {
      alert(error?.response?.data?.message || t('articles.publishFailed'));
    }
  };

  const confirmSchedule = async () => {
    if (!schedulingId || !scheduleFor) return;
    try {
      await api.post(`/articles/${schedulingId}/publish`, {
        publish_at: new Date(scheduleFor).toISOString(),
      });
      setSchedulingId(null);
      setScheduleFor('');
      fetchArticles();
    } catch (error: any) {
      alert(error?.response?.data?.message || t('articles.scheduleFailed'));
    }
  };

  const unpublish = async (article: Article) => {
    try {
      await api.post(`/articles/${article.id}/unpublish`);
      fetchArticles();
    } catch (error: any) {
      alert(error?.response?.data?.message || t('articles.unpublishFailed'));
    }
  };

  const remove = async (article: Article) => {
    if (!confirm(t('articles.deleteConfirm', { title: article.title }))) return;
    try {
      await api.delete(`/articles/${article.id}`);
      fetchArticles();
    } catch (error: any) {
      alert(error?.response?.data?.message || t('articles.deleteFailed'));
    }
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('articles.title')}</h2>
          <p className="text-sm text-gray-500">
            {t('articles.subtitle')}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#ff4757] text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
        >
          <Plus size={18} />
          {t('articles.newArticle')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('articles.searchPlaceholder')}
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ff4757]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | Status)}
          className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
        >
          <option value="">{t('orders.status.all')}</option>
          <option value="draft">{t('articles.status.draft')}</option>
          <option value="scheduled">{t('articles.status.scheduled')}</option>
          <option value="published">{t('articles.status.published')}</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-[#ff4757]" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Globe size={32} className="mx-auto mb-3 text-gray-300" />
            {t('articles.noArticlesYet')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('articles.titleColumn')}</th>
                  <th className="px-5 py-3 font-medium">{t('articles.languages')}</th>
                  <th className="px-5 py-3 font-medium">{t('orders.statusLabel')}</th>
                  <th className="px-5 py-3 font-medium">{t('articles.publishDate')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('orders.actionsLabel')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {article.featured_image ? (
                          <img
                            src={article.featured_image}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{article.title}</div>
                          <div className="text-xs text-gray-400">/{article.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        {article.locales.map((locale) => (
                          <span
                            key={locale}
                            className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600 uppercase"
                          >
                            {locale}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[article.status]}`}>
                        {t(`articles.status.${article.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {article.publish_at ? new Date(article.publish_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {article.status === 'published' && article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noreferrer"
                            title={t('articles.viewPublicPage')}
                            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {article.status === 'published' ? (
                          <button
                            onClick={() => unpublish(article)}
                            title={t('articles.moveBackToDraft')}
                            className="p-2 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"
                          >
                            <EyeOff size={16} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => publishNow(article)}
                              title={t('articles.publishNow')}
                              className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50"
                            >
                              <Send size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setSchedulingId(article.id);
                                setScheduleFor('');
                              }}
                              title={t('articles.schedule')}
                              className="p-2 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"
                            >
                              <Globe size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEdit(article)}
                          title={t('articles.edit')}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => remove(article)}
                          title={t('common.delete')}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Editor ─────────────────────────────────────────── */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? t('articles.editArticle') : t('articles.newArticleTitle')}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>
          )}

          {/* Locale tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
            {translations.map((t) => (
              <button
                key={t.locale}
                type="button"
                onClick={() => setActiveLocale(t.locale)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  t.locale === activeLocale
                    ? 'bg-red-50 text-[#ff4757]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {LOCALES.find((l) => l.code === t.locale)?.label ?? t.locale}
                {translations.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLocale(t.locale);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        removeLocale(t.locale);
                      }
                    }}
                    className="ml-2 text-gray-400 hover:text-red-500"
                  >
                    ×
                  </span>
                )}
              </button>
            ))}

            <select
              value=""
              onChange={(e) => e.target.value && addLocale(e.target.value)}
              className="ml-auto text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600"
            >
              <option value="">{t('articles.addLanguage')}</option>
              {LOCALES.filter((l) => !translations.some((t) => t.locale === l.code)).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {current && (
            <div className="space-y-4" dir={current.locale === 'ar' ? 'rtl' : 'ltr'}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('articles.titleField')}</label>
                <input
                  value={current.title}
                  onChange={(e) => updateCurrent({ title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ff4757]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('articles.slug')} <span className="text-gray-400 font-normal">{t('articles.slugHint')}</span>
                </label>
                <input
                  value={current.slug ?? ''}
                  onChange={(e) => updateCurrent({ slug: e.target.value })}
                  placeholder="our-new-summer-menu"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ff4757]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('articles.excerpt')}</label>
                <textarea
                  value={current.excerpt ?? ''}
                  onChange={(e) => updateCurrent({ excerpt: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ff4757]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">{t('articles.content')}</label>
                  <button
                    type="button"
                    onClick={() => contentImageInputRef.current?.click()}
                    disabled={uploadingContentImage}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#ff4757] disabled:opacity-50"
                  >
                    {uploadingContentImage ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
                    {t('articles.insertImage')}
                  </button>
                  <input
                    ref={contentImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleContentImageSelected}
                    className="hidden"
                  />
                </div>
                <textarea
                  ref={contentTextareaRef}
                  value={current.content}
                  onChange={(e) => updateCurrent({ content: e.target.value })}
                  rows={10}
                  placeholder="<p>Write your post…</p>"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ff4757]"
                />
              </div>
            </div>
          )}

          {/* SEO */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Globe size={16} className="text-gray-400" />
              {t('articles.searchSocialPreview')}
            </h4>

            <div className="flex flex-wrap gap-2">
              {supportedLocales.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveSeoLocale(code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeSeoLocale === code ? 'bg-[#ff4757] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {SEO_LOCALE_LABELS[code] ?? code}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('articles.metaTitle')}</label>
              <input
                value={seo.seo_title[activeSeoLocale] ?? ''}
                onChange={(e) => setSeo({ ...seo, seo_title: { ...seo.seo_title, [activeSeoLocale]: e.target.value } })}
                placeholder={t('articles.metaTitlePlaceholder')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('articles.metaDescription')}
                <span className="text-gray-400 font-normal"> — {t('articles.metaDescriptionCount', { count: seo.seo_description[activeSeoLocale]?.length ?? 0 })}</span>
              </label>
              <textarea
                value={seo.seo_description[activeSeoLocale] ?? ''}
                onChange={(e) => setSeo({ ...seo, seo_description: { ...seo.seo_description, [activeSeoLocale]: e.target.value } })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('articles.socialShareImageUrl')}</label>
              <input
                value={seo.seo_og_image}
                onChange={(e) => setSeo({ ...seo, seo_og_image: e.target.value })}
                placeholder="https://…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="inline-flex items-center gap-2">
                  <ImagePlus size={16} className="text-gray-400" />
                  {t('articles.featuredImage')}
                </span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFeaturedImage(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium"
            >
              {t('menu.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[#ff4757] text-white font-medium hover:bg-red-600 disabled:opacity-60 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {editing ? t('articles.saveChanges') : t('articles.createArticle')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Schedule ───────────────────────────────────────── */}
      <Modal
        isOpen={schedulingId !== null}
        onClose={() => setSchedulingId(null)}
        title={t('articles.schedulePublication')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('articles.scheduleExplain')}
          </p>
          <input
            type="datetime-local"
            value={scheduleFor}
            onChange={(e) => setScheduleFor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setSchedulingId(null)}
              className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium"
            >
              {t('menu.cancel')}
            </button>
            <button
              onClick={confirmSchedule}
              disabled={!scheduleFor}
              className="px-4 py-2 rounded-lg bg-[#ff4757] text-white font-medium hover:bg-red-600 disabled:opacity-60"
            >
              {t('articles.schedule')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
