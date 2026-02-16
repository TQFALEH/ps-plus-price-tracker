import { getMemoryCache, setMemoryCache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";

const COUNTRY_CURRENCY_TTL_SECONDS = 60 * 60 * 24;

interface RestCountriesEntry {
  cca2?: string;
  currencies?: Record<string, unknown>;
}

export async function getCountryLocalCurrencies(isoCode: string): Promise<string[]> {
  const iso = isoCode.toUpperCase();
  const cacheKey = `country-currencies:${iso}`;
  const cached = getMemoryCache<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const currencies = await withRetry(
      async () => {
        const response = await fetch(
          `https://restcountries.com/v3.1/alpha/${iso}?fields=cca2,currencies`,
          {
            headers: { Accept: "application/json" },
            next: { revalidate: COUNTRY_CURRENCY_TTL_SECONDS }
          }
        );

        if (!response.ok) {
          throw new Error(`Country currency request failed (${response.status})`);
        }

        const json = (await response.json()) as RestCountriesEntry[] | RestCountriesEntry;
        const entry = Array.isArray(json) ? json[0] : json;
        const codes = Object.keys(entry?.currencies ?? {}).map((code) => code.toUpperCase());

        if (codes.length === 0) {
          throw new Error("No currencies returned for ISO code");
        }

        return codes;
      },
      1,
      `country-currencies:${iso}`
    );

    setMemoryCache(cacheKey, currencies, COUNTRY_CURRENCY_TTL_SECONDS);
    return currencies;
  } catch (error) {
    logger.warn("Failed to resolve local currencies", { iso, error });
    return [];
  }
}
