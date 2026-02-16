import { Country, CountryInput, GamePriceRecord, PriceRecord } from "@/models";

async function parseJson<T>(res: Response): Promise<T> {
  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error ?? `Request failed with ${res.status}`);
  }
  return payload;
}

export async function getCountries() {
  const res = await fetch("/api/countries", { cache: "no-store" });
  const json = await parseJson<{ data: Country[] }>(res);
  return json.data;
}

export async function addCountry(input: CountryInput) {
  const res = await fetch("/api/countries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const json = await parseJson<{ data: Country }>(res);
  return json.data;
}

export async function removeCountry(id: number) {
  const res = await fetch(`/api/countries/${id}`, { method: "DELETE" });
  await parseJson<{ ok: boolean }>(res);
}

export async function getPrices() {
  const res = await fetch("/api/prices", { cache: "no-store" });
  const json = await parseJson<{ data: PriceRecord[] }>(res);
  return json.data;
}

export async function refreshCountry(countryId: number, force = false) {
  const res = await fetch("/api/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countryId, force })
  });
  const json = await parseJson<{ data: unknown }>(res);
  return json.data;
}

export async function refreshAll(
  force = false,
  options?: { offset?: number; limit?: number }
) {
  const res = await fetch("/api/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true, force, offset: options?.offset, limit: options?.limit })
  });
  const json = await parseJson<{
    data: {
      total: number;
      offset: number;
      limit: number;
      processed: number;
      nextOffset: number | null;
      done: boolean;
      results: Array<{ countryId: number; status: string }>;
    };
  }>(res);
  return json.data;
}

export async function searchGamePrices(params: { name: string; offset?: number; limit?: number }) {
  const qs = new URLSearchParams({
    name: params.name,
    offset: String(params.offset ?? 0),
    limit: String(params.limit ?? 6)
  });
  const res = await fetch(`/api/game-prices?${qs.toString()}`, { cache: "no-store" });
  const json = await parseJson<{
    data: GamePriceRecord[];
    meta: {
      query: string;
      total: number;
      offset: number;
      limit: number;
      processed: number;
      nextOffset: number | null;
      done: boolean;
    };
  }>(res);
  return json;
}
