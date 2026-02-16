import { NextRequest, NextResponse } from "next/server";
import { getPrices } from "@/lib/db";
import { getCountryLocalCurrencies } from "@/lib/country-currency";
import { getFxRate, getRateToSAR } from "@/lib/exchange-rates";

export const runtime = "nodejs";

function normalizeCurrencyForCountry(isoCode: string, currency: string) {
  const iso = isoCode.toUpperCase();
  const curr = currency.toUpperCase();

  // Croatia switched to EUR on January 1, 2023. Some legacy PlayStation metadata still exposes HRK.
  if (iso === "HR" && curr === "HRK") {
    return "EUR";
  }

  return curr;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const country = searchParams.get("country") ?? undefined;
  const currency = searchParams.get("currency") ?? undefined;
  const tier = searchParams.get("tier") ?? undefined;
  const duration = searchParams.get("duration") ? Number(searchParams.get("duration")) : undefined;
  const search = searchParams.get("search") ?? undefined;
  const sortByRaw = searchParams.get("sortBy");
  const sortDirRaw = searchParams.get("sortDir");

  const sortBy =
    sortByRaw === "price" || sortByRaw === "country" || sortByRaw === "lastUpdated"
      ? sortByRaw
      : undefined;
  const sortDir = sortDirRaw === "desc" || sortDirRaw === "asc" ? sortDirRaw : undefined;

  const data = getPrices({
    country,
    currency,
    tier,
    duration,
    search,
    sortBy,
    sortDir
  });

  const normalizedData = data.map((row) => ({
    ...row,
    currency: normalizeCurrencyForCountry(row.isoCode, row.currency)
  }));

  const currencies = Array.from(new Set(normalizedData.map((row) => row.currency.toUpperCase())));
  const isoCodes = Array.from(new Set(normalizedData.map((row) => row.isoCode.toUpperCase())));

  const rateEntries = await Promise.all(
    currencies.map(async (currency) => [currency, await getRateToSAR(currency)] as const)
  );
  const rates = new Map<string, number | null>(rateEntries);

  const localCurrencyEntries = await Promise.all(
    isoCodes.map(async (iso) => [iso, await getCountryLocalCurrencies(iso)] as const)
  );
  const localCurrenciesByIso = new Map<string, string[]>(localCurrencyEntries);

  const fxPairs = new Set<string>();
  for (const row of normalizedData) {
    const localCodes = localCurrenciesByIso.get(row.isoCode.toUpperCase()) ?? [];
    if (localCodes.length === 0) continue;
    if (localCodes.includes(row.currency.toUpperCase())) continue;
    fxPairs.add(`${row.currency.toUpperCase()}->${localCodes[0]}`);
  }

  const fxPairEntries = await Promise.all(
    Array.from(fxPairs).map(async (pair) => {
      const [from, to] = pair.split("->");
      return [pair, await getFxRate(from, to)] as const;
    })
  );
  const fxByPair = new Map<string, number | null>(fxPairEntries);

  const localToSarCurrencies = new Set<string>();
  for (const codes of localCurrenciesByIso.values()) {
    if (codes.length > 0) {
      localToSarCurrencies.add(codes[0]);
    }
  }
  const localToSarEntries = await Promise.all(
    Array.from(localToSarCurrencies).map(async (currency) => [currency, await getRateToSAR(currency)] as const)
  );
  const localToSarByCurrency = new Map<string, number | null>(localToSarEntries);

  const dataWithMeta = normalizedData.map((row) => {
    const rate = rates.get(row.currency.toUpperCase());
    const localCodes = localCurrenciesByIso.get(row.isoCode.toUpperCase()) ?? [];
    const isLocalCurrency =
      localCodes.length > 0 ? localCodes.includes(row.currency.toUpperCase()) : true;
    const localTarget = localCodes[0];
    const localRate =
      localTarget && !isLocalCurrency
        ? fxByPair.get(`${row.currency.toUpperCase()}->${localTarget}`)
        : null;
    const localEstimatedPrice =
      typeof localRate === "number" ? Number((row.price * localRate).toFixed(2)) : null;

    const sarFromSource = typeof rate === "number" ? Number((row.price * rate).toFixed(2)) : null;
    const localToSarRate =
      localTarget && !isLocalCurrency ? localToSarByCurrency.get(localTarget) : null;
    const sarFromLocalEstimate =
      typeof localEstimatedPrice === "number" && typeof localToSarRate === "number"
        ? Number((localEstimatedPrice * localToSarRate).toFixed(2))
        : null;

    return {
      ...row,
      sarPrice: isLocalCurrency ? sarFromSource : (sarFromLocalEstimate ?? sarFromSource),
      isLocalCurrency,
      localCurrencyCodes: localCodes,
      localEstimatedPrice
    };
  });

  return NextResponse.json({ data: dataWithMeta });
}
