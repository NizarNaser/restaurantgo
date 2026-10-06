/** ISO 4217 currencies with 3 decimal places, offered in Settings' currency picker. */
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

/** ISO 4217 currencies with no decimal places, offered in Settings' currency picker. */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);

export function decimalsForCurrency(currency: string): number {
  const code = currency.toUpperCase();
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  return 2;
}

/**
 * Formats just the numeric amount with the right number of decimals for its
 * currency — most currencies use 2 (cents), but a restaurant billing in
 * KWD/BHD/OMR/JOD/TND needs 3 (fils/baisa) and one billing in JPY/KRW/VND
 * needs 0, or the displayed amount silently misrepresents what was actually
 * charged. Laravel's decimal cast serializes as a string in JSON (e.g.
 * "62.50"), not a number, hence the string|number input.
 */
export function formatAmount(amount: number | string, currency: string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return value.toFixed(decimalsForCurrency(currency));
}

/** Same as formatAmount(), with the currency code appended. */
export function formatMoney(amount: number | string, currency: string): string {
  return `${formatAmount(amount, currency)} ${currency}`;
}
