import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { buildPublicPath, getTenantHostSlug } from '../lib/publicSite';

/**
 * Every public tenant page (menu, halls, cart, blog, ...) needs its slug
 * and a way to link to its sibling pages — this hook is the one place that
 * decides whether that comes from the URL's `:slug` param (legacy
 * `/p/:slug/...` routing) or from the hostname itself (a tenant subdomain
 * or connected custom domain), so the page components never need to know
 * which mode they're running in.
 */
export function usePublicSlug() {
  const { slug: pathSlug } = useParams<{ slug?: string }>();
  const hostSlug = useMemo(() => getTenantHostSlug(), []);
  const isHostMode = hostSlug !== null;
  const slug = hostSlug ?? pathSlug;

  return {
    slug,
    isHostMode,
    buildPath: (suffix: string) => buildPublicPath(slug, suffix, isHostMode),
  };
}
