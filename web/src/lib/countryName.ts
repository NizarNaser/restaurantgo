/**
 * Localizes an ISO-3166 country code (e.g. "AE") into the given locale using
 * the browser's own locale data — a branch's `country` is stored/returned as
 * a plain code, never translated on its own. Falls back to the raw code if
 * the runtime can't resolve it.
 */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
