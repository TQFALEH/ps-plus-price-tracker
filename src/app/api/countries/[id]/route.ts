import { NextRequest, NextResponse } from "next/server";
import { deleteCountry } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "Invalid country id" }, { status: 400 });
  }

  const ok = deleteCountry(numId);
  if (!ok) {
    return NextResponse.json({ error: "Country not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
