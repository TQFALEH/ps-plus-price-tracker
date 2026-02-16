import { Country, CountryInput, PriceRecord } from "@/models";

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

export async function refreshAll(force = false) {
  const res = await fetch("/api/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true, force })
  });
  const json = await parseJson<{ data: { results: Array<{ countryId: number; status: string }> } }>(res);
  return json.data;
}
