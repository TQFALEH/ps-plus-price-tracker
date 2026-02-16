import { NextResponse } from "next/server";
import { getDbMode, getPrices, listCountries } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const countries = listCountries();
    const prices = getPrices();
    return NextResponse.json({
      ok: true,
      now: new Date().toISOString(),
      dbMode: getDbMode(),
      counts: {
        countries: countries.length,
        prices: prices.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Health check failed"
      },
      { status: 500 }
    );
  }
}
