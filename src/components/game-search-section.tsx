"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { GamePriceRecord } from "@/models";
import { searchGamePrices } from "@/lib/api-client";

function isoToFlag(isoCode: string) {
  const code = isoCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🏳️";
  }
  return String.fromCodePoint(...Array.from(code).map((char) => 127397 + char.charCodeAt(0)));
}

type GameSort = "sarAsc" | "sarDesc" | "name" | "priceAsc";

export function GameSearchSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const cardsWrapRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<GamePriceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const [countryFilter, setCountryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<GameSort>("sarAsc");
  const [maxSar, setMaxSar] = useState("");

  useEffect(() => {
    if (!sectionRef.current) return;

    gsap.fromTo(
      sectionRef.current,
      { opacity: 0, y: 22, filter: "blur(8px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.75, ease: "power3.out" }
    );
  }, []);

  const countryOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => `${r.isoCode}|${r.countryName}`))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const typeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.productType))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const maxSarValue = maxSar.trim() ? Number(maxSar) : null;

    let output = rows.filter((row) => {
      if (countryFilter !== "all" && row.isoCode !== countryFilter) return false;
      if (typeFilter !== "all" && row.productType !== typeFilter) return false;
      if (maxSarValue !== null && Number.isFinite(maxSarValue) && typeof row.sarPrice === "number" && row.sarPrice > maxSarValue) return false;
      return true;
    });

    output = output.sort((a, b) => {
      if (sortBy === "name") {
        return a.gameName.localeCompare(b.gameName);
      }

      if (sortBy === "priceAsc") {
        const aVal = typeof a.amount === "number" ? a.amount : Number.POSITIVE_INFINITY;
        const bVal = typeof b.amount === "number" ? b.amount : Number.POSITIVE_INFINITY;
        return aVal - bVal;
      }

      const aSar = typeof a.sarPrice === "number" ? a.sarPrice : Number.POSITIVE_INFINITY;
      const bSar = typeof b.sarPrice === "number" ? b.sarPrice : Number.POSITIVE_INFINITY;
      return sortBy === "sarAsc" ? aSar - bSar : bSar - aSar;
    });

    return output;
  }, [rows, countryFilter, typeFilter, sortBy, maxSar]);

  useEffect(() => {
    if (!cardsWrapRef.current) return;
    const cards = Array.from(cardsWrapRef.current.querySelectorAll("[data-game-card]"));
    if (cards.length === 0) return;

    gsap.fromTo(
      cards,
      { opacity: 0, y: 18, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.035, ease: "power2.out" }
    );
  }, [filteredRows]);

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
      setCountryFilter("all");
      setTypeFilter("all");
      setSortBy("sarAsc");
      setProgress(`Found ${all.length} results`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Game search failed");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section ref={sectionRef} className="card mb-4 p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Game Explorer</p>
        <h2 className="text-xl font-bold">Games Price Section</h2>
        <p className="text-sm text-[var(--muted)]">Dedicated search with per-country game prices, posters, and smart filtering.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <input
          className="soft-input"
          placeholder="Example: Elden Ring, GTA V, FC 25"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="primary-btn disabled:opacity-60"
        >
          {loading ? "Searching..." : "Search Game"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select className="soft-select" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="all">All Countries</option>
          {countryOptions.map((entry) => {
            const [iso, name] = entry.split("|");
            return (
              <option key={entry} value={iso}>
                {iso} - {name}
              </option>
            );
          })}
        </select>

        <select className="soft-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Product Types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <input
          className="soft-input"
          placeholder="Max SAR (optional)"
          value={maxSar}
          onChange={(e) => setMaxSar(e.target.value)}
          inputMode="decimal"
        />

        <select className="soft-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as GameSort)}>
          <option value="sarAsc">Sort: SAR low-high</option>
          <option value="sarDesc">Sort: SAR high-low</option>
          <option value="priceAsc">Sort: Local price low-high</option>
          <option value="name">Sort: Game name</option>
        </select>
      </div>

      {progress ? <p className="mt-3 text-xs text-[var(--muted)]">{progress}</p> : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {filteredRows.length > 0 ? (
        <div ref={cardsWrapRef} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((row) => (
            <article data-game-card key={`${row.countryId}-${row.productId}`} className="card ios-game-card overflow-hidden border">
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
      ) : rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-[var(--muted)]">
          No results with current filters.
        </div>
      ) : null}
    </section>
  );
}
