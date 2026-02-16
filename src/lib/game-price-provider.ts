import { Country, GamePriceRecord } from "@/models";
import { getMemoryCache, setMemoryCache } from "@/lib/cache";
import { FETCH_RETRY_COUNT } from "@/lib/utils";
import { withRetry } from "@/lib/retry";
import { getCountryLocalCurrencies } from "@/lib/country-currency";

interface ProductNode {
  id?: string;
  name?: string;
  posterUrl?: string;
  localizedStoreDisplayClassification?: string;
  storeDisplayClassification?: string;
  price?: {
    basePrice?: string;
  };
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

function parseAmount(displayPrice: string): number | null {
  const match = displayPrice.match(/[\d\s.,]+/);
  if (!match) return null;

  let n = match[0].replace(/\s+/g, "");
  const hasComma = n.includes(",");
  const hasDot = n.includes(".");

  if (hasComma && hasDot) {
    if (n.lastIndexOf(",") > n.lastIndexOf(".")) {
      n = n.replace(/\./g, "").replace(",", ".");
    } else {
      n = n.replace(/,/g, "");
    }
  } else if (hasComma) {
    if (/,[0-9]{1,2}$/.test(n)) {
      n = n.replace(",", ".");
    } else {
      n = n.replace(/,/g, "");
    }
  }

  const amount = Number(n);
  return Number.isFinite(amount) ? amount : null;
}

function inferCurrency(displayPrice: string, localCurrency: string | null): string | null {
  const code = displayPrice.match(/\b[A-Z]{3}\b/);
  if (code) {
    return code[0];
  }

  if (displayPrice.includes("€")) return "EUR";
  if (displayPrice.includes("£")) return "GBP";
  if (displayPrice.includes("¥")) return "JPY";
  if (displayPrice.includes("₩")) return "KRW";
  if (displayPrice.includes("₺")) return "TRY";
  if (displayPrice.includes("₽")) return "RUB";
  if (displayPrice.includes("₹")) return "INR";
  if (displayPrice.includes("R$")) return "BRL";
  if (displayPrice.includes("zł")) return "PLN";
  if (displayPrice.includes("kr")) {
    if (localCurrency && ["SEK", "NOK", "DKK"].includes(localCurrency)) return localCurrency;
  }
  if (displayPrice.includes("$") && localCurrency) {
    return localCurrency;
  }

  return localCurrency;
}

function scoreProduct(product: ProductNode, query: string) {
  const name = (product.name ?? "").toLowerCase();
  const type = (product.storeDisplayClassification ?? "").toUpperCase();
  const humanType = (product.localizedStoreDisplayClassification ?? "").toLowerCase();

  let score = 0;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (name.includes(t)) score += 3;
  }

  if (type.includes("FULL_GAME")) score += 4;
  if (type.includes("GAME_BUNDLE")) score += 3;
  if (type.includes("PREMIUM_EDITION")) score += 2;

  if (
    type.includes("ADD_ON") ||
    type.includes("VIRTUAL_CURRENCY") ||
    type.includes("SEASON_PASS") ||
    humanType.includes("add-on") ||
    humanType.includes("avatar") ||
    humanType.includes("theme")
  ) {
    score -= 4;
  }

  return score;
}

function parseProductsFromHtml(html: string): ProductNode[] {
  const tileMatcher = /data-qa="search#productTile(\d+)" data-qa-index="\d+"/g;
  const starts: Array<{ start: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = tileMatcher.exec(html)) !== null) {
    starts.push({ start: match.index });
  }

  if (starts.length === 0) {
    return [];
  }

  const products: ProductNode[] = [];

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i].start;
    const end = i + 1 < starts.length ? starts[i + 1].start : html.length;
    const block = html.slice(start, end);

    const href = block.match(/href="([^"]*\/product\/[^"]+)"/i)?.[1] ?? null;
    const nameRaw = block.match(/#product-name"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null;
    const priceRaw = block.match(/#price#display-price"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null;
    const typeRaw = block.match(/#product-type"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null;
    const posterRaw =
      block.match(/#game-art#image#image-no-js"[^>]*src="([^"]+)"/i)?.[1] ??
      block.match(/#game-art#image#preview"[^>]*src="([^"]+)"/i)?.[1] ??
      null;

    if (!href || !nameRaw || !priceRaw) continue;

    const id = href.split("/product/")[1] ?? href;
    const type = decodeHtmlEntities(typeRaw ?? "Unknown");

    products.push({
      id,
      name: decodeHtmlEntities(nameRaw),
      posterUrl: posterRaw ? decodeHtmlEntities(posterRaw).replace(/\?w=\d+&thumb=true$/, "") : undefined,
      localizedStoreDisplayClassification: type,
      storeDisplayClassification: type.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
      price: {
        basePrice: decodeHtmlEntities(priceRaw)
      }
    });
  }

  return products;
}

async function fetchSearchHtml(country: Country, query: string) {
  const cacheKey = `game-search:${country.isoCode}:${query.toLowerCase()}`;
  const cached = getMemoryCache<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const searchUrl = `https://store.playstation.com/${country.regionIdentifier}/search/${encodeURIComponent(query)}`;
  const html = await withRetry(
    async () => {
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "PSPlusPriceTracker/1.0 (+backend fetch)",
          Accept: "text/html,application/xhtml+xml"
        },
        next: { revalidate: 60 * 30 }
      });

      if (!response.ok) {
        throw new Error(`Failed fetching ${searchUrl} (${response.status})`);
      }

      return response.text();
    },
    FETCH_RETRY_COUNT,
    `game-search:${country.isoCode}`
  );

  setMemoryCache(cacheKey, html, 1800);
  return html;
}

export async function fetchBestGamePriceForCountry(
  country: Country,
  query: string
): Promise<Omit<GamePriceRecord, "sarPrice"> | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const html = await fetchSearchHtml(country, trimmed);
  const products = parseProductsFromHtml(html);
  if (products.length === 0) {
    return null;
  }

  const localCurrencies = await getCountryLocalCurrencies(country.isoCode);
  const localCurrency = localCurrencies[0] ?? null;

  const priced = products.filter((p) => typeof p.price?.basePrice === "string");

  const candidates = priced
    .map((p) => ({
      product: p,
      score: scoreProduct(p, trimmed)
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const fallback = priced.find((p) => {
    const type = (p.storeDisplayClassification ?? "").toUpperCase();
    const humanType = (p.localizedStoreDisplayClassification ?? "").toLowerCase();
    const priceText = decodeHtmlEntities(p.price?.basePrice ?? "");

    if (!priceText || /^free$/i.test(priceText)) return false;
    if (
      type.includes("ADD_ON") ||
      type.includes("VIRTUAL_CURRENCY") ||
      type.includes("SEASON_PASS") ||
      humanType.includes("add-on") ||
      humanType.includes("avatar") ||
      humanType.includes("theme")
    ) {
      return false;
    }
    return true;
  });

  const best = candidates[0]?.product ?? fallback;
  if (!best || !best.price?.basePrice || !best.id || !best.name) {
    return null;
  }

  const displayPrice = decodeHtmlEntities(best.price.basePrice);
  if (/^free$/i.test(displayPrice)) {
    return null;
  }

  const amount = parseAmount(displayPrice);
  const currency = inferCurrency(displayPrice, localCurrency);

  return {
    countryId: country.id,
    countryName: country.name,
    isoCode: country.isoCode,
    gameName: decodeHtmlEntities(best.name),
    posterUrl: best.posterUrl ?? null,
    productType: best.localizedStoreDisplayClassification ?? best.storeDisplayClassification ?? "Unknown",
    productId: best.id,
    currency,
    amount,
    displayPrice,
    sourceUrl: `https://store.playstation.com/${country.regionIdentifier}/product/${best.id}`
  };
}
