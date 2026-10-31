export interface CityOption {
  value: string;
  label: string;
}

export type FilterOptions = Record<string, CityOption[]>;

/** Branches with no country set are grouped under an empty key — their cities stay searchable, but it isn't a country to offer. */
export function countryCodes(filters: FilterOptions): string[] {
  return Object.keys(filters).filter(Boolean);
}

export function citiesFor(filters: FilterOptions, country: string): CityOption[] {
  if (country) return filters[country] ?? [];

  const byValue = new Map(Object.values(filters).flat().map((city) => [city.value, city]));
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
}
