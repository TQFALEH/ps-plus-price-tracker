import { CountryInput } from "@/models";
import { getMemoryCache, setMemoryCache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { fetchOfficialPageHtml } from "@/lib/ps-plus-provider";

const DISCOVERY_CACHE_KEY = "ps-plus-country-discovery";
const DISCOVERY_TTL_SECONDS = 60 * 60 * 24;

function getCountryName(isoCode: string) {
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" }).of(isoCode);
    return display ?? isoCode;
  } catch {
    return isoCode;
  }
}

function parseDiscoveredCountries(html: string): CountryInput[] {
  const matcher = /<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/gi;
  const seenByIso = new Map<string, CountryInput>();

  let match: RegExpExecArray | null;
  while ((match = matcher.exec(html)) !== null) {
    const hreflang = match[1].toLowerCase();
    const href = match[2];

    if (hreflang === "x-default" || !href.includes("/ps-plus/")) {
      continue;
    }

    const parts = hreflang.split("-");
    const isoCode = parts[parts.length - 1]?.toUpperCase();
    if (!isoCode || !/^[A-Z]{2}$/.test(isoCode)) {
      continue;
    }

    if (seenByIso.has(isoCode)) {
      continue;
    }

    seenByIso.set(isoCode, {
      name: getCountryName(isoCode),
      isoCode,
      regionIdentifier: hreflang,
      sourceUrl: href
    });
  }

  return Array.from(seenByIso.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function discoverSupportedCountries() {
  const cached = getMemoryCache<CountryInput[]>(DISCOVERY_CACHE_KEY);
  if (cached) {
    return cached;
  }

  try {
    const html = await fetchOfficialPageHtml("https://www.playstation.com/en-us/ps-plus/");
    const countries = parseDiscoveredCountries(html);
    setMemoryCache(DISCOVERY_CACHE_KEY, countries, DISCOVERY_TTL_SECONDS);
    return countries;
  } catch (error) {
    logger.warn("Failed discovering countries from official source", { error });
    return [];
  }
}
