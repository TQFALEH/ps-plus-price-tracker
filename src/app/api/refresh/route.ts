import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { refreshSchema } from "@/lib/validation";
import { refreshAll, refreshOne } from "@/lib/pricing-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for") ?? "local";
  const limit = checkRateLimit(clientIp);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const json = await request.json();
    const payload = refreshSchema.parse(json);

    if (payload.all) {
      const result = await refreshAll(Boolean(payload.force));
      return NextResponse.json({ data: result });
    }

    if (!payload.countryId && !payload.isoCode) {
      return NextResponse.json(
        { error: "Provide countryId or isoCode, or set all=true" },
        { status: 400 }
      );
    }

    const result = await refreshOne({
      countryId: payload.countryId,
      isoCode: payload.isoCode,
      force: payload.force
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 400 }
    );
  }
}
