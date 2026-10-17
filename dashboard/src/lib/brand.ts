// Platform brand and domain, set per build via VITE_APP_NAME /
// VITE_BASE_DOMAIN so a rename is an env change rather than a code search.
// VITE_BASE_DOMAIN is empty in local dev (no wildcard DNS), so the domain
// falls back to production's for display text such as the support address.
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) || 'RestoAtlas';
export const APP_DOMAIN = ((import.meta.env.VITE_BASE_DOMAIN as string | undefined) || 'restoatlas.com').toLowerCase();
export const APP_TAGLINE = 'All-in-One Restaurant Management Platform';
