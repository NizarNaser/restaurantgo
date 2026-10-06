import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapPin, Star, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { countryName } from '../lib/countryName';

export interface Restaurant {
  tenant_name: string;
  tenant_slug: string;
  logo_path: string | null;
  description: string | null;
  branch_id: number;
  address: string | null;
  city: string | null;
  country: string | null;
  rating_average: number | null;
  rating_count: number;
}

const AVATAR_GRADIENTS = [
  'from-orange-400 to-red-400',
  'from-blue-400 to-indigo-400',
  'from-emerald-400 to-teal-400',
  'from-purple-400 to-pink-400',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
];

export function gradientFor(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

export default function RestaurantCard({ restaurant, rank, delay = 0 }: { restaurant: Restaurant; rank?: number; delay?: number }) {
  const { t, i18n } = useTranslation();
  const r = restaurant;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay }}
      className="h-full"
    >
      <Link to={`/restaurants/${r.tenant_slug}`} className="card card-hover overflow-hidden block h-full relative">
        {rank && (
          <span className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/95 backdrop-blur text-[var(--color-primary)] font-extrabold text-sm flex items-center justify-center shadow-[var(--shadow-soft)]">
            {rank}
          </span>
        )}
        <div className={`h-36 bg-gradient-to-br ${gradientFor(r.tenant_name)} flex items-center justify-center relative overflow-hidden`}>
          {r.logo_path ? (
            <img src={r.logo_path} alt={r.tenant_name} className="w-full h-full object-cover" />
          ) : (
            <ChefHat size={40} className="text-white/90" />
          )}
        </div>
        <div className="p-4">
          <h3 className="font-bold text-gray-900">{r.tenant_name}</h3>
          <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
            <MapPin size={14} /> {[r.city, r.country && countryName(r.country, i18n.resolvedLanguage ?? 'en')].filter(Boolean).join(t('common.citySeparator'))}
          </p>
          {r.rating_average && (
            <p className="mt-2 text-sm text-amber-600 flex items-center gap-1 font-medium">
              <Star size={14} fill="currentColor" /> {r.rating_average} <span className="text-gray-400 font-normal">({r.rating_count})</span>
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
