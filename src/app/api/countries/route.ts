import { NextRequest, NextResponse } from "next/server";
import { countrySchema } from "@/lib/validation";
import { insertCountriesIfMissing, insertCountry, listCountries } from "@/lib/db";
import { discoverSupportedCountries } from "@/lib/country-discovery";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  const discovered = await discoverSupportedCountries();
  if (discovered.length > 0) {
    const inserted = insertCountriesIfMissing(discovered);
    if (inserted > 0) {
      logger.info("Synced discovered countries from official source", { inserted });
    }
  }

  const data = listCountries();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = countrySchema.parse(json);
    const created = insertCountry({
      name: parsed.name,
      isoCode: parsed.isoCode,
      regionIdentifier: parsed.regionIdentifier,
      sourceUrl: parsed.sourceUrl || undefined
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json({ error: "Country with this ISO code already exists" }, { status: 409 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request"
      },
      { status: 400 }
    );
  }
}
