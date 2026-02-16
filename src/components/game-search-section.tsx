"use client";

import { useMemo, useState } from "react";
import { GamePriceRecord } from "@/models";
import { searchGamePrices } from "@/lib/api-client";

function isoToFlag(isoCode: string) {
  const code = isoCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🏳️";
  }
  return String.fromCodePoint(...Array.from(code).map((char) => 127397 + char.charCodeAt(0)));
}

export function GameSearchSection() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<GamePriceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aSar = typeof a.sarPrice === "number" ? a.sarPrice : Number.POSITIVE_INFINITY;
      const bSar = typeof b.sarPrice === "number" ? b.sarPrice : Number.POSITIVE_INFINITY;
      return aSar - bSar;
    });
  }, [rows]);

  async function onSearch() {
    const name = query.trim();
    if (!name) {
      setError("Enter a game name first");
      return;
    }

    setError("");
    setLoading(true);
    setRows([]);
    setProgress("Searching...");

    try {
      const batchSize = 6;
      let offset = 0;
      let done = false;
      const all: GamePriceRecord[] = [];

      while (!done) {
        const response = await searchGamePrices({ name, offset, limit: batchSize });
        all.push(...response.data);

        const meta = response.meta;
        const from = meta.offset + 1;
        const to = meta.offset + meta.processed;
        setProgress(`Scanning stores ${from}-${to} / ${meta.total}`);

        offset = meta.nextOffset ?? 0;
        done = meta.done;
      }

      setRows(all);
      setProgress(`Found ${all.length} results`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Game search failed");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card mb-4 p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Game Finder</p>
        <h2 className="text-xl font-bold">Search Game Prices By Country</h2>
        <p className="text-sm text-[var(--muted)]">Type a game name and compare prices across PlayStation stores.</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="soft-input flex-1"
          placeholder="Example: Elden Ring, GTA V, FC 25"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="primary-btn md:min-w-[220px] disabled:opacity-60"
        >
          {loading ? "Searching..." : "Search Game"}
        </button>
      </div>

      {progress ? <p className="mt-3 text-xs text-[var(--muted)]">{progress}</p> : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {sorted.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((row) => (
            <article key={`${row.countryId}-${row.productId}`} className="card overflow-hidden border">
              <div className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-slate-900">
                {row.posterUrl ? (
                  <img src={row.posterUrl} alt={row.gameName} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">No Poster</div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                  {isoToFlag(row.isoCode)} {row.isoCode}
                </span>
              </div>

              <div className="space-y-2 p-3">
                <h3 className="text-sm font-semibold">{row.gameName}</h3>
                <p className="text-xs text-[var(--muted)]">{row.countryName} • {row.productType}</p>

                <div className="rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-900/60">
                  <p className="font-semibold">{row.displayPrice}{row.currency ? ` (${row.currency})` : ""}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {typeof row.sarPrice === "number" ? `${row.sarPrice.toFixed(2)} SAR` : "SAR unavailable"}
                  </p>
                </div>

                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Open In Store
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
