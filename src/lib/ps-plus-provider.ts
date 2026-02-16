import { Country, DurationMonths, Tier } from "@/models";
import { getMemoryCache, setMemoryCache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";
import { FETCH_RETRY_COUNT } from "@/lib/utils";
import { parseLocalizedNumber } from "@/lib/number-parsing";

export interface ParsedPrice {
  tier: Tier;
  durationMonths: DurationMonths;
  price: number;
  currency: string;
  sourceUrl: string;
}

function defaultPsPlusUrl(regionIdentifier: string) {
  return `https://www.playstation.com/${regionIdentifier}/ps-plus/`;
}

function inferTier(text: string): Tier | null {
  const lower = text.toLowerCase();
  if (lower.includes("essential")) {
    return "Essential";
  }
  if (lower.includes("extra")) {
    return "Extra";
  }
  if (lower.includes("premium") || lower.includes("deluxe")) {
    return "Premium";
  }
  return null;
}

function inferDuration(text: string): DurationMonths | null {
  const lower = text.toLowerCase();
  if (/(12|year|annual)/.test(lower)) {
    return 12;
  }
  if (/(3|quarter)/.test(lower)) {
    return 3;
  }
  if (/(1|month)/.test(lower)) {
    return 1;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  return parseLocalizedNumber(value);
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const parsed: unknown[] = [];

  for (const block of blocks) {
    const content = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    if (!content) continue;

    try {
      parsed.push(JSON.parse(content) as unknown);
    } catch {
      logger.warn("Failed to parse JSON-LD block");
    }
  }

  return parsed;
}

function collectOfferCandidates(node: unknown, out: Array<Record<string, unknown>>) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectOfferCandidates(item, out);
    }
    return;
  }
  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;

  if (record.price && record.priceCurrency) {
    out.push(record);
  }

  for (const value of Object.values(record)) {
    collectOfferCandidates(value, out);
  }
}

function normalizeAndDedupe(entries: ParsedPrice[]) {
  const deduped = new Map<string, ParsedPrice>();
  for (const row of entries) {
    deduped.set(`${row.tier}-${row.durationMonths}`, row);
  }
  return Array.from(deduped.values());
}

function getMinorUnitDivisor(currency: string) {
  try {
    const fractionDigits = new Intl.NumberFormat("en", {
      style: "currency",
      currency
    }).resolvedOptions().maximumFractionDigits;
    return 10 ** (fractionDigits ?? 2);
  } catch {
    return 100;
  }
}

function parseFromDataProductInfo(html: string, sourceUrl: string): ParsedPrice[] {
  const match = html.match(/data-product-info="([\s\S]*?)"\s+data-advanced-age-gate=/i);
  if (!match?.[1]) {
    return [];
  }

  try {
    const decoded = decodeHtmlEntities(match[1]);
    const productInfo = JSON.parse(decoded) as {
      skus?: Array<{ name?: string; price?: number | string; priceCurrency?: string }>;
    };

    const results: ParsedPrice[] = [];

    for (const sku of productInfo.skus ?? []) {
      const name = sku.name ?? "";
      const tier = inferTier(name);
      const durationMonths = inferDuration(name);
      const price = parseNumber(sku.price);
      const currency = sku.priceCurrency?.toUpperCase();

      if (!tier || !durationMonths || price === null || !currency) {
        continue;
      }

      results.push({
        tier,
        durationMonths,
        price,
        currency,
        sourceUrl
      });
    }

    return normalizeAndDedupe(results);
  } catch (error) {
    logger.warn("Failed parsing data-product-info", { sourceUrl, error });
    return [];
  }
}

function parseFromTierSelectorScripts(html: string, sourceUrl: string): ParsedPrice[] {
  const scriptMatcher = /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  const tierMap: Record<string, Tier> = {
    TIER_10: "Essential",
    TIER_20: "Extra",
    TIER_30: "Premium"
  };

  const parsed: ParsedPrice[] = [];
  let match: RegExpExecArray | null;

  while ((match = scriptMatcher.exec(html)) !== null) {
    const content = match[1]?.trim();
    if (!content || !content.includes("tierSelectorOffersRetrieve")) {
      continue;
    }

    try {
      const json = JSON.parse(content) as {
        args?: { tierId?: string };
        cache?: {
          ROOT_QUERY?: Record<
            string,
            {
              offers?: Array<{
                duration?: { value?: number };
                price?: { basePriceValue?: number; currencyCode?: string };
              }>;
            }
          >;
        };
      };

      const tier = json.args?.tierId ? tierMap[json.args.tierId] : null;
      if (!tier || !json.cache?.ROOT_QUERY) {
        continue;
      }

      for (const value of Object.values(json.cache.ROOT_QUERY)) {
        for (const offer of value?.offers ?? []) {
          const durationMonths = offer.duration?.value as DurationMonths | undefined;
          const minorAmount = offer.price?.basePriceValue;
          const currency = offer.price?.currencyCode?.toUpperCase();

          if (!durationMonths || (durationMonths !== 1 && durationMonths !== 3 && durationMonths !== 12)) {
            continue;
          }
          if (typeof minorAmount !== "number" || !currency) {
            continue;
          }

          const divisor = getMinorUnitDivisor(currency);

          parsed.push({
            tier,
            durationMonths,
            price: minorAmount / divisor,
            currency,
            sourceUrl
          });
        }
      }
    } catch {
      // Ignore malformed script blocks.
    }
  }

  return normalizeAndDedupe(parsed);
}

function parseFromJsonLd(html: string, sourceUrl: string): ParsedPrice[] {
  const jsonBlocks = extractJsonLdBlocks(html);
  const offers: Array<Record<string, unknown>> = [];

  for (const block of jsonBlocks) {
    collectOfferCandidates(block, offers);
  }

  const results: ParsedPrice[] = [];

  for (const offer of offers) {
    const contextText = [offer.name, offer.description, offer.category].filter(Boolean).join(" ");
    const tier = inferTier(contextText);
    const durationMonths = inferDuration(contextText);
    const rawPrice = parseNumber(offer.price);
    const currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency.toUpperCase() : null;

    if (!tier || !durationMonths || !currency || rawPrice === null) {
      continue;
    }

    results.push({
      tier,
      durationMonths,
      price: rawPrice,
      currency,
      sourceUrl
    });
  }

  return normalizeAndDedupe(results);
}

export function parsePricesFromHtml(html: string, sourceUrl: string): ParsedPrice[] {
  const fromTierSelector = parseFromTierSelectorScripts(html, sourceUrl);
  if (fromTierSelector.length > 0) {
    return fromTierSelector;
  }

  const fromProductInfo = parseFromDataProductInfo(html, sourceUrl);
  if (fromProductInfo.length > 0) {
    return fromProductInfo;
  }

  return parseFromJsonLd(html, sourceUrl);
}

export async function fetchOfficialPageHtml(url: string) {
  const cacheKey = `source:${url}`;
  const cached = getMemoryCache<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const html = await withRetry(
    async () => {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "PSPlusPriceTracker/1.0 (+backend fetch)",
          Accept: "text/html,application/xhtml+xml"
        },
        next: { revalidate: 60 * 30 }
      });

      if (!response.ok) {
        throw new Error(`Failed fetching ${url} (${response.status})`);
      }

      return response.text();
    },
    FETCH_RETRY_COUNT,
    `fetch:${url}`
  );

  setMemoryCache(cacheKey, html, 1800);
  return html;
}

export async function fetchCountryPrices(country: Country): Promise<ParsedPrice[]> {
  const sourceUrl = country.sourceUrl ?? defaultPsPlusUrl(country.regionIdentifier);
  const html = await fetchOfficialPageHtml(sourceUrl);
  const parsed = parsePricesFromHtml(html, sourceUrl);

  if (parsed.length === 0) {
    logger.warn("No prices parsed from official source", {
      country: country.isoCode,
      sourceUrl
    });
  }

  return parsed;
}
