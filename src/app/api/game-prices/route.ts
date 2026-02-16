import { NextRequest, NextResponse } from "next/server";
import { listCountries } from "@/lib/db";
import { fetchBestGamePriceForCountry } from "@/lib/game-price-provider";
import { getRateToSAR } from "@/lib/exchange-rates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const name = (searchParams.get("name") ?? "").trim();
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));
    const limit = Math.min(12, Math.max(1, Number(searchParams.get("limit") ?? 6)));

    if (!name) {
      return NextResponse.json({ error: "Query parameter 'name' is required" }, { status: 400 });
    }

    const countries = listCountries();
    const total = countries.length;
    const batch = countries.slice(offset, offset + limit);

    const rawResults = await Promise.all(
      batch.map(async (country) => {
        try {
          return await fetchBestGamePriceForCountry(country, name);
        } catch {
          return null;
        }
      })
    );

    const filtered = rawResults.filter((r): r is NonNullable<typeof r> => Boolean(r));

    const currencyRates = new Map<string, number | null>();
    for (const row of filtered) {
      if (!row.currency || currencyRates.has(row.currency)) continue;
      currencyRates.set(row.currency, await getRateToSAR(row.currency));
    }

    const data = filtered.map((row) => {
      const rate = row.currency ? currencyRates.get(row.currency) : null;
      const sarPrice = typeof row.amount === "number" && typeof rate === "number"
        ? Number((row.amount * rate).toFixed(2))
        : null;

      return {
        ...row,
        sarPrice
      };
    });

    const nextOffset = offset + batch.length < total ? offset + batch.length : null;

    return NextResponse.json({
      data,
      meta: {
        query: name,
        total,
        offset,
        limit,
        processed: batch.length,
        nextOffset,
        done: nextOffset === null
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed loading game prices"
      },
      { status: 500 }
    );
  }
}
