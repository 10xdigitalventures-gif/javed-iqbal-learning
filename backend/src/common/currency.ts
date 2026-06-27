// Lightweight multi-currency support for displaying prices. Charges are always
// taken in the plan's own currency (PKR by default); conversion here is purely
// for showing buyers an approximate price in their preferred currency.
//
// Rates are "units of <currency> per 1 PKR". Override the defaults at runtime
// with the EXCHANGE_RATES_PKR env var (a JSON object), e.g.
//   EXCHANGE_RATES_PKR={"USD":0.0036,"GBP":0.0028}

export type CurrencyInfo = { code: string; symbol: string; name: string };

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "GBP", name: "British Pound" },
  { code: "EUR", symbol: "EUR", name: "Euro" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
];

const DEFAULT_RATES: Record<string, number> = {
  PKR: 1,
  USD: 0.0036,
  GBP: 0.0028,
  EUR: 0.0033,
  SAR: 0.0135,
  AED: 0.0132,
};

export function exchangeRates(): Record<string, number> {
  const raw = process.env.EXCHANGE_RATES_PKR;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { PKR: 1, ...parsed };
      }
    } catch {
      // fall through to defaults on malformed env
    }
  }
  return DEFAULT_RATES;
}

export function isSupportedCurrency(code?: string | null): boolean {
  if (!code) return false;
  return SUPPORTED_CURRENCIES.some((c) => c.code === code.toUpperCase());
}

export function currencyInfo(code: string): CurrencyInfo {
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase());
  return found || { code: code.toUpperCase(), symbol: code, name: code };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Convert an amount from one currency to another using PKR as the base.
export function convert(amount: number, from: string, to: string): number {
  const rates = exchangeRates();
  const fromCode = (from || "PKR").toUpperCase();
  const toCode = (to || "PKR").toUpperCase();
  const rFrom = rates[fromCode];
  const rTo = rates[toCode];
  if (!rFrom || !rTo) return round2(amount);
  const inPkr = amount / rFrom;
  return round2(inPkr * rTo);
}

// A display-friendly quote in the requested currency.
export function quote(amount: number, from: string, to?: string) {
  const target = to && isSupportedCurrency(to) ? to.toUpperCase() : "PKR";
  const value = convert(amount, from, target);
  const info = currencyInfo(target);
  return {
    amount: value,
    currency: target,
    symbol: info.symbol,
    formatted: info.symbol + " " + value.toLocaleString("en-US"),
  };
}
