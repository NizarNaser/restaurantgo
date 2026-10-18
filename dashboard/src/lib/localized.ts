// Resolves a locale-keyed field to one string: exact language match, then
// the first available translation, then the given default.
export function pick(localized: Record<string, string> | null | undefined, locale: string, fallback: string): string {
  if (!localized) return fallback;
  const short = locale.split('-')[0];
  const value = localized[locale] ?? localized[short] ?? Object.values(localized).find(Boolean);
  return value || fallback;
}
