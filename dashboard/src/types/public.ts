export interface PublicCategory {
  id: number;
  name: string;
  department_id: number | null;
}

export interface PublicDepartment {
  id: number;
  name: string;
}

export interface PublicMenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  weight: string | null;
  tags: string[];
  is_featured: boolean;
  is_available: boolean;
  price: number | string;
  currency: string;
  image_url: string | null;
  image_thumb_url: string | null;
  image_card_url: string | null;
  avg_rating: number | null;
  reviews_count: number;
}

export interface RestaurantContact {
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  working_hours: Record<string, string> | null;
  latitude: number | null;
  longitude: number | null;
  maps_embed_url: string | null;
}

export interface RestaurantAnalytics {
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
}

export interface RestaurantSocial {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
  youtube: string | null;
  snapchat: string | null;
}

export interface RestaurantInfo {
  name: string;
  slug: string;
  description: string;
  avatar: string | null;
  cover_image: string | null;
  favicon: string | null;
  locale: string;
  default_locale: string;
  supported_locales: string[];
  blog_url: string;
  service_charge_rate: number;
  service_charge_message: string | null;
  contact: RestaurantContact | null;
  service_rating: { average: number | null; count: number };
  analytics: RestaurantAnalytics;
  social: RestaurantSocial;
}

/** Emoji per dietary tag — the label itself comes from the `tags.*` i18n keys. */
export const TAG_META: Record<string, { emoji: string }> = {
  vegetarian: { emoji: '🥦' },
  vegan: { emoji: '🌱' },
  gluten_free: { emoji: '🌾' },
  spicy: { emoji: '🌶️' },
  halal: { emoji: '☪️' },
};

const WEEKDAY_KEYS: string[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function formatWorkingHours(
  hours: Record<string, string> | null,
  t: (key: string) => string,
): { day: string; range: string }[] {
  if (!hours) return [];
  return WEEKDAY_KEYS
    .filter((key) => hours[key])
    .map((key) => ({ day: t(`weekdays.${key}`), range: hours[key] }));
}

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}
