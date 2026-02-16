import { getMemoryCache, setMemoryCache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";

const FX_TTL_SECONDS = 60 * 60 * 6;

interface FxResponse {
  result: string;
  rates: Record<string, number>;
}

export async function getFxRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return 1;
  }

  const cacheKey = `fx:${from}:${to}`;
  const cached = getMemoryCache<number>(cacheKey);
  if (typeof cached === "number") {
    return cached;
  }

  try {
    const result = await withRetry(
      async () => {
        const response = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
          headers: { Accept: "application/json" },
          next: { revalidate: FX_TTL_SECONDS }
        });

        if (!response.ok) {
          throw new Error(`FX request failed (${response.status})`);
        }

        const json = (await response.json()) as FxResponse;
        if (json.result !== "success") {
          throw new Error("FX provider returned unsuccessful result");
        }
        const rate = json.rates?.[to];
        if (typeof rate !== "number" || !Number.isFinite(rate)) {
          throw new Error("Invalid FX response");
        }

        return rate;
      },
      2,
      `fx:${from}:${to}`
    );

    setMemoryCache(cacheKey, result, FX_TTL_SECONDS);
    return result;
  } catch (error) {
    logger.warn("Failed loading FX rate", { from, to, error });
    return null;
  }
}

export async function getRateToSAR(fromCurrency: string): Promise<number | null> {
  return getFxRate(fromCurrency, "SAR");
}
