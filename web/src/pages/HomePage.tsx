import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Utensils, Calendar, BarChart3, Users, ArrowRight, Sparkles, Star, Building2, Heart, Search, Megaphone, Trophy, Truck, Wand2, Printer, LayoutGrid, Boxes, Languages, Bot } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import api from '../api/axios';
import AdSlot from '../components/AdSlot';
import Pagination from '../components/Pagination';
import Reveal from '../components/Reveal';
import RestaurantCard, { type Restaurant } from '../components/RestaurantCard';

const PER_PAGE = 10;

type FilterOptions = Record<string, string[]>;

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const services = [
    { icon: Utensils, title: t('home.services.menu.title'), desc: t('home.services.menu.desc'), color: 'from-orange-400 to-red-400' },
    { icon: Calendar, title: t('home.services.reservations.title'), desc: t('home.services.reservations.desc'), color: 'from-blue-400 to-indigo-400' },
    { icon: BarChart3, title: t('home.services.financial.title'), desc: t('home.services.financial.desc'), color: 'from-emerald-400 to-teal-400' },
    { icon: Users, title: t('home.services.hr.title'), desc: t('home.services.hr.desc'), color: 'from-purple-400 to-pink-400' },
    { icon: Truck, title: t('home.services.delivery.title'), desc: t('home.services.delivery.desc'), color: 'from-amber-400 to-orange-500' },
    { icon: Wand2, title: t('home.services.settingsHelp.title'), desc: t('home.services.settingsHelp.desc'), color: 'from-sky-400 to-blue-500' },
    { icon: Printer, title: t('home.services.invoicePrinting.title'), desc: t('home.services.invoicePrinting.desc'), color: 'from-rose-400 to-red-500' },
    { icon: LayoutGrid, title: t('home.services.reservationScreen.title'), desc: t('home.services.reservationScreen.desc'), color: 'from-indigo-400 to-violet-500' },
    { icon: Boxes, title: t('home.services.inventory.title'), desc: t('home.services.inventory.desc'), color: 'from-lime-400 to-emerald-500' },
    { icon: Languages, title: t('home.services.multiLanguage.title'), desc: t('home.services.multiLanguage.desc'), color: 'from-cyan-400 to-teal-500' },
    { icon: Bot, title: t('home.services.aiChat.title'), desc: t('home.services.aiChat.desc'), color: 'from-fuchsia-400 to-purple-500' },
  ];

  const stats = [
    { icon: Building2, value: '+150', label: t('home.stats.restaurants') },
    { icon: Calendar, value: '+12,000', label: t('home.stats.bookings') },
    { icon: Star, value: '4.8', label: t('home.stats.rating') },
    { icon: Heart, value: '+30', label: t('home.stats.countries') },
  ];
  const [filters, setFilters] = useState<FilterOptions>({});
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');

  const [topRated, setTopRated] = useState<Restaurant[] | null>(null);
  const [registered, setRegistered] = useState<Restaurant[] | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  useEffect(() => {
    api.get('/v1/directory/filters').then((res) => setFilters(res.data)).catch(() => {});
    api.get('/v1/directory/top-rated', { params: { limit: 5 } }).then((res) => setTopRated(res.data)).catch(() => setTopRated([]));
  }, []);

  useEffect(() => {
    setRegistered(null);
    api.get('/v1/directory/restaurants', { params: { per_page: PER_PAGE, page } })
      .then((res) => {
        setRegistered(res.data.data);
        setLastPage(res.data.last_page ?? 1);
      })
      .catch(() => setRegistered([]));
  }, [page]);

  const cities = country ? filters[country] ?? [] : Object.values(filters).flat();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (country) params.set('country', country);
    if (city) params.set('city', city);
    navigate(`/restaurants${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative bg-mesh">
        <div className="container-page py-16 sm:py-24 grid md:grid-cols-2 gap-10 items-center relative">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="section-eyebrow">
              <Sparkles size={14} /> {t('home.hero.eyebrow')}
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
              <Trans i18nKey="home.hero.title" components={{ hl: <span className="text-gradient" /> }} />
            </h1>
            <p className="mt-5 text-lg text-gray-600 max-w-lg">
              {t('home.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register" className="btn btn-primary text-base">
                {t('home.hero.ctaPrimary')}
              </Link>
              <Link to="/restaurants" className="btn btn-outline text-base">
                {t('home.hero.ctaSecondary')}
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -top-8 -right-6 w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-300 to-red-300 opacity-40 blur-2xl animate-float" />
            <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-gradient-to-br from-blue-300 to-purple-300 opacity-30 blur-2xl animate-float" style={{ animationDelay: '2s' }} />
            {/* Paid advertising spot: shows a sponsored restaurant ad when one is
                active, otherwise invites restaurant owners to buy the placement. */}
            <AdSlot
              placement="home_hero"
              carousel
              fallback={
                <Link to="/contact" className="card p-8 relative block group">
                  <div className="icon-badge bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-4 shadow-[var(--shadow-glow)] transition-transform group-hover:scale-110">
                    <Megaphone size={22} />
                  </div>
                  <p className="font-bold text-gray-900">{t('home.adFallback.title')}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    {t('home.adFallback.desc')}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]">
                    {t('nav.contact')} <ArrowRight size={15} className="rtl:rotate-180" />
                  </span>
                </Link>
              }
            />
          </motion.div>
        </div>

        {/* Search + filter */}
        <div className="container-page pb-16 sm:pb-20 relative">
          <Reveal delay={0.1}>
            <form onSubmit={handleSearch} className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input ps-11 border-0 bg-gray-50"
                  placeholder={t('home.search.placeholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="input bg-gray-50 border-0 sm:w-44"
                value={country}
                onChange={(e) => { setCountry(e.target.value); setCity(''); }}
              >
                <option value="">{t('directory.allCountries')}</option>
                {Object.keys(filters).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input bg-gray-50 border-0 sm:w-44" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">{t('directory.allCities')}</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="submit" className="btn btn-primary sm:px-6">
                <Search size={18} /> {t('home.search.button')}
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[var(--color-secondary)] py-8">
        <div className="container-page grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="flex items-center gap-3 justify-center sm:justify-start">
              <s.icon size={22} className="text-[var(--color-primary)]" />
              <div>
                <p className="text-xl font-extrabold text-white">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Top 10 restaurants */}
      {topRated && topRated.length > 0 && (
        <section className="bg-white py-16 sm:py-20">
          <div className="container-page">
            <Reveal className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <span className="section-eyebrow"><Trophy size={14} /> {t('home.topRated.eyebrow')}</span>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-gray-900">{t('home.topRated.title')}</h2>
              </div>
              <Link to="/restaurants" className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-1">
                {t('home.viewAll')} <ArrowRight size={15} className="rtl:rotate-180" />
              </Link>
            </Reveal>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {topRated.map((r, i) => (
                <RestaurantCard key={`${r.tenant_slug}-${r.branch_id}`} restaurant={r} rank={i + 1} delay={i * 0.06} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Registered restaurants */}
      <section className="bg-[var(--color-background)] py-16 sm:py-20">
        <div className="container-page">
          <Reveal className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <span className="section-eyebrow">{t('home.registered.eyebrow')}</span>
              <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-gray-900">{t('home.registered.title')}</h2>
            </div>
            <Link to="/restaurants" className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-1">
              {t('home.registered.viewAll')} <ArrowRight size={15} className="rtl:rotate-180" />
            </Link>
          </Reveal>

          {registered === null ? (
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card"><div className="h-36 skeleton" /><div className="p-4 space-y-2"><div className="h-4 w-2/3 rounded skeleton" /><div className="h-3 w-1/2 rounded skeleton" /></div></div>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {registered.map((r, i) => (
                  <RestaurantCard key={`${r.tenant_slug}-${r.branch_id}`} restaurant={r} delay={i * 0.06} />
                ))}
              </div>
              <Pagination currentPage={page} lastPage={lastPage} onChange={setPage} />
            </>
          )}
        </div>
      </section>

      {/* Services */}
      <section className="bg-white py-16 sm:py-24">
        <div className="container-page">
          <Reveal className="text-center max-w-xl mx-auto">
            <span className="section-eyebrow">{t('home.services.eyebrow')}</span>
            <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-gray-900">{t('home.services.title')}</h2>
          </Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1}>
                <motion.div whileHover={{ y: -6 }} className="card card-hover p-6 h-full">
                  <div className={`icon-badge bg-gradient-to-br ${s.color} text-white mb-4 shadow-[var(--shadow-glow)]`}>
                    <s.icon size={22} />
                  </div>
                  <h3 className="font-bold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{s.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-16 sm:py-24">
        <div className="grid md:grid-cols-3 gap-8 items-start">
          <Reveal className="md:col-span-2">
            <div className="card p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gradient-to-br from-white to-red-50/40 relative overflow-hidden">
              <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-red-100/60 blur-3xl" />
              <div className="relative">
                <h2 className="text-2xl font-extrabold text-gray-900">{t('home.cta.title')}</h2>
                <p className="mt-2 text-gray-500">{t('home.cta.desc')}</p>
              </div>
              <Link to="/register" className="btn btn-primary shrink-0 relative">
                {t('nav.registerCta')} <ArrowRight size={18} className="rtl:rotate-180" />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <AdSlot placement="home_sidebar" />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
