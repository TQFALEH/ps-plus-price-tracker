import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { refreshSchema } from "@/lib/validation";
import { refreshAll, refreshOne } from "@/lib/pricing-service";
import { createRefreshJob, getRefreshJob } from "@/lib/refresh-jobs";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }
  const job = getRefreshJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ data: job });
}

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
      if (payload.async) {
        const job = createRefreshJob({
          force: payload.force,
          staleOnly: payload.staleOnly ?? true
        });
        return NextResponse.json({ data: { jobId: job.id, status: job.status } });
      }

      const result = await refreshAll(Boolean(payload.force), {
        offset: payload.offset,
        limit: payload.limit
      });
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
    logger.error("Refresh API request failed", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 400 }
    );
  }
}
