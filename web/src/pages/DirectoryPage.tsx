import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import AdSlot from '../components/AdSlot';
import Pagination from '../components/Pagination';
import Reveal from '../components/Reveal';
import RestaurantCard, { type Restaurant } from '../components/RestaurantCard';

const PER_PAGE = 10;

type Filters = Record<string, string[]>;

function CardSkeleton() {
  return (
    <div className="card">
      <div className="h-36 skeleton" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 rounded skeleton" />
        <div className="h-3 w-1/2 rounded skeleton" />
      </div>
    </div>
  );
}

export default function DirectoryPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [country, setCountry] = useState(searchParams.get('country') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/v1/directory/filters').then((res) => setFilters(res.data)).catch(() => {});
  }, []);

  // Any filter change starts the results over from page 1.
  useEffect(() => {
    setPage(1);
  }, [country, city, search]);

  useEffect(() => {
    setLoading(true);
    const urlParams: Record<string, string> = {};
    if (country) urlParams.country = country;
    if (city) urlParams.city = city;
    if (search) urlParams.search = search;
    if (page > 1) urlParams.page = String(page);
    setSearchParams(urlParams, { replace: true });

    api.get('/v1/directory/restaurants', { params: { ...urlParams, per_page: PER_PAGE, page } })
      .then((res) => {
        setRestaurants(res.data.data);
        setLastPage(res.data.last_page ?? 1);
      })
      .finally(() => setLoading(false));
  }, [country, city, search, page]);

  const cities = country ? filters[country] ?? [] : Object.values(filters).flat();

  return (
    <div className="container-page py-10">
      <Reveal>
        <h1 className="text-3xl font-extrabold text-gray-900">{t('directory.title')}</h1>
        <p className="mt-2 text-gray-500">{t('directory.subtitle')}</p>
      </Reveal>

      <Reveal delay={0.08} className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input ps-11"
            placeholder={t('directory.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input bg-white sm:w-48"
          value={country}
          onChange={(e) => { setCountry(e.target.value); setCity(''); }}
        >
          <option value="">{t('directory.allCountries')}</option>
          {Object.keys(filters).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input bg-white sm:w-48" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">{t('directory.allCities')}</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Reveal>

      <AdSlot placement="directory_top" className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" />

      {loading ? (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : restaurants.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-16 flex flex-col items-center text-center gap-3"
        >
          <div className="icon-badge w-16 h-16 bg-gray-100 text-gray-400">
            <SearchX size={28} />
          </div>
          <p className="text-gray-500 font-medium">{t('directory.noResults')}</p>
        </motion.div>
      ) : (
        <>
          <motion.div layout className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {restaurants.map((r, i) => (
                <RestaurantCard key={`${r.tenant_slug}-${r.branch_id}`} restaurant={r} delay={Math.min(i, 6) * 0.05} />
              ))}
            </AnimatePresence>
          </motion.div>
          <Pagination
            currentPage={page}
            lastPage={lastPage}
            onChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
    </div>
  );
}
