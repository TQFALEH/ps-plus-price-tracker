import { Country, RefreshResult } from "@/models";
import {
  areCountryPricesFresh,
  getCountryPriceSnapshot,
  getCountryById,
  getCountryByIso,
  insertCountriesIfMissing,
  listCountries,
  upsertPrices
} from "@/lib/db";
import { discoverSupportedCountries } from "@/lib/country-discovery";
import { logger } from "@/lib/logger";
import { fetchCountryPrices } from "@/lib/ps-plus-provider";
import { nowIso, toCacheExpiryIso } from "@/lib/utils";

export async function refreshCountry(
  country: Country,
  force = false
): Promise<RefreshResult> {
  try {
    if (!force && areCountryPricesFresh(country.id)) {
      return {
        countryId: country.id,
        isoCode: country.isoCode,
        updated: 0,
        status: "cached"
      };
    }

    const parsed = await fetchCountryPrices(country);

    if (parsed.length === 0) {
      return {
        countryId: country.id,
        isoCode: country.isoCode,
        updated: 0,
        status: "error",
        message: "No parsable price data returned from source"
      };
    }

    const now = nowIso();
    const expiry = toCacheExpiryIso();

    upsertPrices(
      parsed.map((entry) => ({
        countryId: country.id,
        currency: entry.currency,
        tier: entry.tier,
        durationMonths: entry.durationMonths,
        price: entry.price,
        sourceUrl: entry.sourceUrl,
        lastUpdated: now,
        cacheExpiresAt: expiry
      }))
    );

    return {
      countryId: country.id,
      isoCode: country.isoCode,
      updated: parsed.length,
      status: "ok"
    };
  } catch (error) {
    logger.error("Refresh country failed", {
      countryId: country.id,
      isoCode: country.isoCode,
      error
    });

    return {
      countryId: country.id,
      isoCode: country.isoCode,
      updated: 0,
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function refreshOne(params: { countryId?: number; isoCode?: string; force?: boolean }) {
  const country =
    typeof params.countryId === "number"
      ? getCountryById(params.countryId)
      : params.isoCode
        ? getCountryByIso(params.isoCode)
        : null;

  if (!country) {
    throw new Error("Country not found");
  }

  const result = await refreshCountry(country, Boolean(params.force));
  return {
    result,
    snapshot: getCountryPriceSnapshot(country.id)
  };
}

export async function refreshAll(force = false) {
  const discovered = await discoverSupportedCountries();
  if (discovered.length > 0) {
    const inserted = insertCountriesIfMissing(discovered);
    if (inserted > 0) {
      logger.info("Discovered and inserted countries from official source", { inserted });
    }
  }

  const countries = listCountries();
  const results: RefreshResult[] = [];

  for (const country of countries) {
    const result = await refreshCountry(country, force);
    results.push(result);
  }

  return {
    startedAt: nowIso(),
    total: countries.length,
    ok: results.filter((r) => r.status === "ok").length,
    cached: results.filter((r) => r.status === "cached").length,
    failed: results.filter((r) => r.status === "error").length,
    results
  };
}
